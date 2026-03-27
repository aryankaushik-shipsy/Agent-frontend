import { TIER_MINIMUMS, HITL_THRESHOLD } from '../constants'
import type { Carrier } from '../types/carrier'

export function computeMarginMessage(carrier: Carrier, tier: string): string {
  const tierMin = TIER_MINIMUMS[tier] ?? 5
  const margin = carrier.markup_pct
  const aboveThreshold = carrier.grand_total > HITL_THRESHOLD

  const mainMsg = `Selected carrier (${carrier.carrier}) yields ${margin}% margin — ${
    margin >= tierMin ? 'above' : 'below'
  } ${tier} minimum of ${tierMin}%.`

  const thresholdMsg = aboveThreshold
    ? 'Requires HITL approval (above $5,000 threshold).'
    : 'Auto-approval eligible (below $5,000 threshold).'

  return `${mainMsg} ${thresholdMsg}`
}

export function isAboveThreshold(grandTotal: number): boolean {
  return grandTotal > HITL_THRESHOLD
}
