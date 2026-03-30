import type { Carrier } from '../types/carrier'
import type { JobDetail } from '../types/job'

// Reads full carrier data (with breakdown, markup, subtotal) from the
// calculate_final_price task output — more complete than the intervention payload
export function getCarriersFromTask(job: JobDetail): Carrier[] {
  const task = job.tasks?.find((t) => t.title === 'calculate_final_price')
  if (!task?.output_json) return []
  const out = task.output_json as { results?: Carrier[] }
  return out.results ?? []
}

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
