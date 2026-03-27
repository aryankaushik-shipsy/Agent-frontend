import { useQuery } from '@tanstack/react-query'
import { getJobById } from '../api/jobs'

export function useJob(jobId: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJobById(jobId!),
    enabled: jobId != null && options?.enabled !== false,
    staleTime: 60_000,
  })
}
