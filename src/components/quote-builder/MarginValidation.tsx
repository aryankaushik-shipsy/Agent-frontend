import { computeMarginMessage, isAboveThreshold } from '../../utils/margin'
import type { Carrier } from '../../types/carrier'

interface Props {
  carrier: Carrier
  tier: string
}

export function MarginValidation({ carrier, tier }: Props) {
  const msg = computeMarginMessage(carrier, tier)
  const warn = isAboveThreshold(carrier.grand_total)

  return (
    <div className={`margin-box${warn ? ' warn' : ''}`}>
      <p>{msg}</p>
    </div>
  )
}
