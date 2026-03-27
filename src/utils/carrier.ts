import type { Carrier } from '../types/carrier'

export function getCarrierInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function findBestPriceIndex(carriers: Carrier[]): number {
  if (!carriers.length) return 0
  let bestIdx = 0
  let bestTotal = carriers[0].grand_total
  for (let i = 1; i < carriers.length; i++) {
    if (carriers[i].grand_total < bestTotal) {
      bestTotal = carriers[i].grand_total
      bestIdx = i
    }
  }
  return bestIdx
}

export function formatCurrency(amount: number, code: string): string {
  return `${code} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
