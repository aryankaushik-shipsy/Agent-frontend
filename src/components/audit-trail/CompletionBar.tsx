import { formatRuntime } from '../../utils/time'
import type { JobDetail } from '../../types/job'

interface Props {
  job: JobDetail
}

export function CompletionBar({ job }: Props) {
  if (job.status !== 'success') return null

  const hasManualApproval = job.interventions.some(
    (i) => i.action_taken && i.action_taken_by_user_name
  )
  const approvalNote = hasManualApproval ? 'Manually approved' : 'Auto-approved'

  return (
    <div className="completion-bar">
      <div className="completion-bar-title">Job completed successfully</div>
      <div className="completion-bar-meta">
        <span>Total time: {formatRuntime(job.runtime)}</span>
        <span>{approvalNote}</span>
      </div>
    </div>
  )
}
