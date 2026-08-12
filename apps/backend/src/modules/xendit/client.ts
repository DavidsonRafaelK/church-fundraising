import { MedusaError } from "@medusajs/framework/utils"

const XENDIT_API_URL = "https://api.xendit.co"

export type XenditInvoiceStatus = "PENDING" | "PAID" | "SETTLED" | "EXPIRED"

export type XenditInvoice = {
  id: string
  external_id: string
  status: XenditInvoiceStatus
  amount: number
  paid_amount?: number
  currency: string
  invoice_url: string
  expiry_date: string
}

export type XenditBalance = {
  balance: number
  account_type: string
}

export type CreateInvoiceParams = {
  externalId: string
  amount: number
  currency: string
  description: string
  payerEmail?: string
  successRedirectUrl?: string
  failureRedirectUrl?: string
}

type XenditClientOptions = {
  secretKey: string
  timeoutMs?: number
}

export class XenditClient {
  private readonly secretKey: string
  private readonly timeoutMs: number

  constructor(options: XenditClientOptions) {
    this.secretKey = options.secretKey
    this.timeoutMs = options.timeoutMs ?? 15000
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response

    try {
      response = await fetch(`${XENDIT_API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: this.authHeader(),
          ...init.headers,
        },
        signal: controller.signal,
      })
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Permintaan ke Xendit (${path}) melebihi batas waktu ${this.timeoutMs}ms`
        )
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Permintaan ke Xendit (${path}) gagal: ${(error as Error).message}`
      )
    } finally {
      clearTimeout(timeout)
    }

    const body = await response.json().catch(() => undefined)

    if (!response.ok) {
      if (response.status === 401) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Xendit API key tidak valid (401 Unauthorized). Periksa XENDIT_SECRET_KEY."
        )
      }

      const message =
        body && typeof body === "object" && "message" in body
          ? (body as { message: string }).message
          : `Xendit mengembalikan status ${response.status}`

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Xendit error (${path}): ${message}`
      )
    }

    return body as T
  }

  createInvoice(params: CreateInvoiceParams): Promise<XenditInvoice> {
    return this.request<XenditInvoice>("/v2/invoices", {
      method: "POST",
      body: JSON.stringify({
        external_id: params.externalId,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        payer_email: params.payerEmail,
        success_redirect_url: params.successRedirectUrl,
        failure_redirect_url: params.failureRedirectUrl,
      }),
    })
  }

  getInvoice(invoiceId: string): Promise<XenditInvoice> {
    return this.request<XenditInvoice>(`/v2/invoices/${invoiceId}`)
  }

  async expireInvoice(invoiceId: string): Promise<XenditInvoice | undefined> {
    try {
      return await this.request<XenditInvoice>(`/invoices/${invoiceId}/expire!`, {
        method: "POST",
      })
    } catch {
      // Best-effort: an already-paid or already-expired invoice can't be
      // expired again, and that's not an error worth surfacing here.
      return undefined
    }
  }

  getBalance(accountType = "CASH"): Promise<XenditBalance> {
    return this.request<XenditBalance>(
      `/balance?account_type=${encodeURIComponent(accountType)}`
    )
  }
}
