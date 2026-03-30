import { useQueries } from '@tanstack/react-query'
import { getJobById } from '../api/jobs'
import type { JobDetail } from '../types/job'

const TERMINAL = new Set(['success', 'failed'])

export function useJobDetails(jobIds: number[], options?: { refetchInterval?: number }) {
  const results = useQueries({
    queries: jobIds.map((id) => ({
      queryKey: ['job', id],
      queryFn: () => getJobById(id),
      staleTime: 15_000,
      gcTime: 600_000,          // keep in cache 10 min
      refetchOnWindowFocus: false,
      // Poll active jobs at the given interval; stop once terminal
      refetchInterval: (query: { state: { data?: { status?: string } } }) => {
        if (TERMINAL.has(query.state.data?.status ?? '')) return false
        return options?.refetchInterval ?? 15_000
      },
    })),
  })

  const data = results
    .map((r) => r.data)
    .filter((d): d is JobDetail => d != null)

  const isLoading = results.some((r) => r.isLoading)
  const errors = results.map((r) => r.error).filter(Boolean)

  return { data, isLoading, errors }
}
