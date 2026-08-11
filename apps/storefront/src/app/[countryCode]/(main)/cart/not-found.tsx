import { Metadata } from "next"

import InteractiveLink from "@modules/common/components/interactive-link"

export const metadata: Metadata = {
  title: "404",
  description: "Terjadi kesalahan",
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">Halaman tidak ditemukan</h1>
      <p className="text-small-regular text-ui-fg-base">
        Keranjang yang Anda coba akses tidak tersedia. Hapus cookie Anda dan
        coba lagi.
      </p>
      <InteractiveLink href="/">Kembali ke beranda</InteractiveLink>
    </div>
  )
}
