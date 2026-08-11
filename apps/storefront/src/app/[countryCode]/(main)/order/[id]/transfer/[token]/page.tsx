import { Heading, Text } from "@modules/common/components/ui"
import TransferActions from "@modules/order/components/transfer-actions"
import TransferImage from "@modules/order/components/transfer-image"

export default async function TransferPage({
  params,
}: {
  params: { id: string; token: string }
}) {
  const { id, token } = params

  return (
    <div className="flex flex-col gap-y-4 items-start w-2/5 mx-auto mt-10 mb-20">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        <Heading level="h1" className="text-xl text-zinc-900">
          Permintaan pemindahan untuk pesanan {id}
        </Heading>
        <Text className="text-zinc-600">
          Anda menerima permintaan untuk memindahkan kepemilikan pesanan Anda
          ({id}). Jika Anda menyetujui permintaan ini, Anda dapat menyetujui
          pemindahan dengan mengklik tombol di bawah ini.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <Text className="text-zinc-600">
          Jika Anda menyetujui, pemilik baru akan mengambil alih semua
          tanggung jawab dan hak akses yang terkait dengan pesanan ini.
        </Text>
        <Text className="text-zinc-600">
          Jika Anda tidak mengenali permintaan ini atau ingin tetap
          mempertahankan kepemilikan, tidak ada tindakan lebih lanjut yang
          diperlukan.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <TransferActions id={id} token={token} />
      </div>
    </div>
  )
}
