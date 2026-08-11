import { Metadata } from "next"
import { Suspense } from "react"

import VerifyAccount from "@modules/account/components/verify-account"

export const metadata: Metadata = {
  title: "Verifikasi email Anda",
  description: "Verifikasi alamat email Anda untuk menyelesaikan pendaftaran.",
}

export default function VerifyAccountPage() {
  return (
    <div className="w-full flex justify-center px-8 py-12">
      <Suspense
        fallback={
          <p className="text-base-regular text-ui-fg-base">
            Memverifikasi email Anda...
          </p>
        }
      >
        <VerifyAccount />
      </Suspense>
    </div>
  )
}
