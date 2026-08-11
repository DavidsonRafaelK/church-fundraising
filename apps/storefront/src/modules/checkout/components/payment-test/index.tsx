import { Badge } from "@modules/common/components/ui"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">Perhatian:</span> Hanya untuk keperluan
      pengujian.
    </Badge>
  )
}

export default PaymentTest
