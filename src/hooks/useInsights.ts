import { useQuery } from '@tanstack/react-query'
import { getInsights } from '../api/insights'

export function useInsights(from: string, to: string) {
  return useQuery({
    queryKey: ['insights', from, to],
    queryFn: () => getInsights(from, to),
    staleTime: 60_000,
  })
}
