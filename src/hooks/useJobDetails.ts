import { useQueries } from '@tanstack/react-query'
import { getJobById } from '../api/jobs'
import type { JobDetail } from '../types/job'

export function useJobDetails(jobIds: number[]) {
  const results = useQueries({
    queries: jobIds.map((id) => ({
      queryKey: ['job', id],
      queryFn: () => getJobById(id),
      staleTime: 300_000,       // 5 min — survive tab switches and back-navigation
      gcTime: 600_000,          // keep in cache 10 min
      refetchOnWindowFocus: false,
    })),
  })

  const data = results
    .map((r) => r.data)
    .filter((d): d is JobDetail => d != null)

  const isLoading = results.some((r) => r.isLoading)
  const errors = results.map((r) => r.error).filter(Boolean)

  return { data, isLoading, errors }
}
