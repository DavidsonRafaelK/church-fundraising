import { placeOrder, retrieveCart } from "@lib/data/cart"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Button, Heading, Text } from "@modules/common/components/ui"
import { Metadata } from "next"
import { notFound, unstable_rethrow } from "next/navigation"

export const metadata: Metadata = {
  title: "Menyelesaikan pembayaran",
}

type Props = {
  searchParams: Promise<{ outcome?: string; session_id?: string }>
}

const RetryNotice = ({ title, message }: { title: string; message: string }) => (
  <div className="content-container flex flex-col items-center justify-center py-24 gap-y-4 text-center">
    <Heading level="h1">{title}</Heading>
    <Text className="text-ui-fg-subtle max-w-md">{message}</Text>
    <LocalizedClientLink href="/checkout?step=payment">
      <Button>Kembali ke checkout</Button>
    </LocalizedClientLink>
  </div>
)

export default async function XenditReturnPage(props: Props) {
  const { outcome } = await props.searchParams

  if (outcome === "failure") {
    return (
      <RetryNotice
        title="Pembayaran belum selesai"
        message="Invoice Xendit kedaluwarsa atau dibatalkan. Silakan coba lagi dari halaman checkout."
      />
    )
  }

  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  try {
    // placeOrder() throws a Next.js redirect() once the cart turns into an
    // order -- that's expected control flow here, not a failure. It checks
    // the Xendit invoice's live status, so this succeeds even if the
    // webhook (which runs on a short delay) hasn't landed yet.
    await placeOrder()
  } catch (error) {
    unstable_rethrow(error)

    return (
      <RetryNotice
        title="Pembayaran masih diproses"
        message="Kami belum menerima konfirmasi pembayaran dari Xendit. Jika Anda sudah membayar, tunggu sebentar lalu muat ulang halaman ini."
      />
    )
  }

  return null
}
