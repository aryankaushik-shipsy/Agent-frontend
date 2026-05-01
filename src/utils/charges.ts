import type { BreakdownLine } from '../types/carrier'

/**
 * The full charge-header universe for an Aramex air/freight quote. Every
 * supported lane carries rates for these 10 lines in the master; incoterm
 * logic on the backend decides which ones get *priced* — but on the card
 * the reviewer should always see all 10, with `0` filled in for the lines
 * the current incoterm excludes (rather than the row simply disappearing).
 *
 * Each entry's `aliases` are normalized substrings the backend may use as
 * the charge label. Matching is case-insensitive and tolerant of minor
 * punctuation / whitespace differences.
 */
const CANONICAL_CHARGES: Array<{ label: string; aliases: string[] }> = [
  { label: 'Air Freight',                aliases: ['air freight'] },
  { label: 'Fuel Surcharge (FSC)',       aliases: ['fuel surcharge', 'fsc'] },
  { label: 'Security Surcharge (SSC)',   aliases: ['security surcharge', 'ssc'] },
  { label: 'Airport Handling - Origin',  aliases: ['airport handling - origin', 'airport handling origin', 'handling - origin', 'handling origin'] },
  { label: 'Airport Handling - Dest.',   aliases: ['airport handling - dest', 'airport handling - destination', 'airport handling dest', 'airport handling destination', 'handling - dest', 'handling - destination', 'handling dest', 'handling destination'] },
  { label: 'Insurance',                  aliases: ['insurance'] },
  { label: 'Customs Clearance - Origin', aliases: ['customs clearance - origin', 'customs clearance origin', 'customs - origin', 'customs origin'] },
  { label: 'Customs Clearance - Dest.',  aliases: ['customs clearance - dest', 'customs clearance - destination', 'customs clearance dest', 'customs clearance destination', 'customs - dest', 'customs - destination', 'customs dest', 'customs destination'] },
  { label: 'Airway Bill (AWB) Fee',      aliases: ['airway bill', 'awb fee', 'awb'] },
  { label: 'Service Markup',             aliases: ['service markup', 'markup'] },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    // Treat en-dash / em-dash / hyphen-minus identically — backend mixes them
    // ("Airport Handling – Origin" vs "Airport Handling - Origin").
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[().]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matches(charge: string, entry: { label: string; aliases: string[] }): boolean {
  const n = normalize(charge)
  // Direct alias hit (exact)
  if (entry.aliases.some((a) => n === normalize(a))) return true
  // Prefix hit — covers "Service Markup (Bronze 15%)" → "service markup",
  // "AWB fee — courier" → "awb fee", etc.
  if (entry.aliases.some((a) => n.startsWith(normalize(a)))) return true
  return false
}

/**
 * Always returns a breakdown containing all 10 canonical charge headers in
 * canonical order. For each canonical entry, the matching line from the
 * backend payload is used verbatim (preserving the backend's own label —
 * e.g. "Service Markup (Bronze 15%)" — and any rate_source / note hints).
 * Unmatched canonical entries get a zero placeholder. Any backend lines
 * that don't match a canonical entry (e.g. VAT) are appended at the end so
 * nothing the backend supplied is silently dropped.
 */
export function expandToCanonicalBreakdown(
  breakdown: BreakdownLine[] | undefined | null,
): BreakdownLine[] {
  const supplied = breakdown ?? []
  const matched = new Set<number>()
  const result: BreakdownLine[] = []

  for (const entry of CANONICAL_CHARGES) {
    const idx = supplied.findIndex((line, i) => !matched.has(i) && matches(line.charge, entry))
    if (idx >= 0) {
      matched.add(idx)
      result.push(supplied[idx])
    } else {
      result.push({ charge: entry.label, amount: 0 })
    }
  }

  for (let i = 0; i < supplied.length; i++) {
    if (!matched.has(i)) result.push(supplied[i])
  }

  return result
}
