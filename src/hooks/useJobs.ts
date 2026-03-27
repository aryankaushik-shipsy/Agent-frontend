import { useQuery } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import type { JobFilter } from '../types/api'

export function useJobs(filter: JobFilter, options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['jobs', filter],
    queryFn: () => getJobs(filter),
    staleTime: 30_000,
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  })
}
