import crypto from "crypto"
import { AbstractPaymentProvider, BigNumber, MedusaError } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { XenditClient, XenditInvoice, XenditBalance } from "./client"
import { XenditProviderOptions } from "./types"

type InjectedDependencies = {
  logger: Logger
}

class XenditProviderService extends AbstractPaymentProvider<XenditProviderOptions> {
  static identifier = "xendit"

  protected logger_: Logger
  protected options_: XenditProviderOptions
  protected client_: XenditClient

  static validateOptions(options: Record<string, unknown>) {
    if (!options.secretKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `secretKey` wajib diisi pada Xendit payment provider."
      )
    }
    if (!options.callbackToken) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `callbackToken` wajib diisi pada Xendit payment provider, dipakai untuk memverifikasi webhook."
      )
    }
  }

  constructor(container: InjectedDependencies, options: XenditProviderOptions) {
    super(container, options)

    this.logger_ = container.logger
    this.options_ = options
    this.client_ = new XenditClient({ secretKey: options.secretKey })
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id as string

    const invoice = await this.client_.createInvoice({
      externalId: sessionId,
      amount: new BigNumber(input.amount).numeric,
      currency: input.currency_code.toUpperCase(),
      description: `Pembayaran pesanan ${sessionId}`,
      payerEmail: input.context?.customer?.email,
      successRedirectUrl: this.buildRedirectUrl(sessionId, "success"),
      failureRedirectUrl: this.buildRedirectUrl(sessionId, "failure"),
    })

    return {
      id: invoice.id,
      status: "pending",
      data: this.toSessionData(invoice, sessionId),
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const invoiceId = input.data?.invoice_id as string | undefined

    if (!invoiceId) {
      return { status: "pending_authorization", data: input.data }
    }

    const invoice = await this.client_.getInvoice(invoiceId)
    const sessionId = input.data?.session_id as string

    if (invoice.status === "PAID" || invoice.status === "SETTLED") {
      return { status: "authorized", data: this.toSessionData(invoice, sessionId) }
    }

    return { status: "pending_authorization", data: this.toSessionData(invoice, sessionId) }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const invoiceId = input.data?.invoice_id as string | undefined

    if (!invoiceId) {
      return { status: "pending", data: input.data }
    }

    const invoice = await this.client_.getInvoice(invoiceId)
    const sessionId = input.data?.session_id as string

    return {
      status: this.mapInvoiceStatus(invoice.status),
      data: this.toSessionData(invoice, sessionId),
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // A Xendit invoice settles the full amount the moment it's paid -- there
    // is no separate capture call to make with the provider.
    return { data: input.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return this.deletePayment(input)
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    const invoiceId = input.data?.invoice_id as string | undefined

    if (invoiceId) {
      await this.client_.expireInvoice(invoiceId)
    }

    return { data: input.data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const sessionId = input.data?.session_id as string
    const previousInvoiceId = input.data?.invoice_id as string | undefined

    if (previousInvoiceId) {
      await this.client_.expireInvoice(previousInvoiceId)
    }

    const invoice = await this.client_.createInvoice({
      externalId: sessionId,
      amount: new BigNumber(input.amount).numeric,
      currency: input.currency_code.toUpperCase(),
      description: `Pembayaran pesanan ${sessionId}`,
      payerEmail: input.context?.customer?.email,
      successRedirectUrl: this.buildRedirectUrl(sessionId, "success"),
      failureRedirectUrl: this.buildRedirectUrl(sessionId, "failure"),
    })

    return { status: "pending", data: this.toSessionData(invoice, sessionId) }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const invoiceId = input.data?.invoice_id as string | undefined

    if (!invoiceId) {
      return { data: input.data }
    }

    const invoice = await this.client_.getInvoice(invoiceId)
    const sessionId = input.data?.session_id as string

    return { data: this.toSessionData(invoice, sessionId) }
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Refund tidak didukung lewat integrasi Xendit ini. Proses refund secara manual lewat dashboard Xendit."
    )
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { data, headers } = payload
    const receivedToken = headers?.["x-callback-token"] as string | undefined

    if (!this.isValidCallbackToken(receivedToken)) {
      this.logger_.warn(
        "Xendit webhook diterima dengan X-CALLBACK-TOKEN yang tidak valid atau tidak ada -- diabaikan."
      )
      return { action: "not_supported" }
    }

    const body = data as {
      external_id?: string
      status?: string
      amount?: number
      paid_amount?: number
    }

    if (!body.external_id) {
      return { action: "not_supported" }
    }

    if (body.status === "PAID" || body.status === "SETTLED") {
      return {
        action: "captured",
        data: {
          session_id: body.external_id,
          amount: new BigNumber(body.paid_amount ?? body.amount ?? 0),
        },
      }
    }

    if (body.status === "EXPIRED") {
      return {
        action: "canceled",
        data: {
          session_id: body.external_id,
          amount: new BigNumber(body.amount ?? 0),
        },
      }
    }

    return { action: "not_supported" }
  }

  /** Read-only balance lookup used by the admin balance route. */
  async getBalance(accountType?: string): Promise<XenditBalance> {
    return this.client_.getBalance(accountType)
  }

  private isValidCallbackToken(receivedToken: string | undefined): boolean {
    if (!receivedToken) {
      return false
    }

    const expected = Buffer.from(this.options_.callbackToken)
    const received = Buffer.from(receivedToken)

    if (expected.length !== received.length) {
      return false
    }

    return crypto.timingSafeEqual(expected, received)
  }

  private mapInvoiceStatus(
    status: XenditInvoice["status"]
  ): "captured" | "canceled" | "pending" {
    switch (status) {
      case "PAID":
      case "SETTLED":
        return "captured"
      case "EXPIRED":
        return "canceled"
      default:
        return "pending"
    }
  }

  private toSessionData(invoice: XenditInvoice, sessionId: string): Record<string, unknown> {
    return {
      invoice_id: invoice.id,
      invoice_url: invoice.invoice_url,
      external_id: invoice.external_id,
      session_id: sessionId,
      status: invoice.status,
    }
  }

  private buildRedirectUrl(sessionId: string, outcome: "success" | "failure"): string | undefined {
    if (!this.options_.storefrontUrl) {
      return undefined
    }

    // The storefront is Indonesia-only (single "id" region), so the
    // country-code segment of its routes is always "id".
    const url = new URL("/id/xendit-return", this.options_.storefrontUrl)
    url.searchParams.set("session_id", sessionId)
    url.searchParams.set("outcome", outcome)
    return url.toString()
  }
}

export default XenditProviderService
