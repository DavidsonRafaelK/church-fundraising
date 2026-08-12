import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type XenditProviderService from "../../../../modules/xendit/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  let provider: XenditProviderService

  try {
    provider = req.scope.resolve<XenditProviderService>("pp_xendit_xendit")
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Xendit payment provider belum terdaftar. Periksa konfigurasi modules di medusa-config.ts."
    )
  }

  const balance = await provider.getBalance()

  return res.status(200).json({ balance })
}
