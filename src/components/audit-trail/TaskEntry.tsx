import { Badge } from '../ui/Badge'
import { formatRuntime } from '../../utils/time'
import { useState } from 'react'
import type { Task } from '../../types/job'

interface Props {
  task: Task
}

function getAvatarText(title: string): string {
  const words = title.split(/[\s_]+/)
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function isToolNode(title: string): boolean {
  return title.toLowerCase().includes('get_rate') ||
    title.toLowerCase().includes('get_tier') ||
    title.toLowerCase().includes('send') ||
    title.toLowerCase().includes('tool')
}

export function TaskEntry({ task }: Props) {
  const [expanded, setExpanded] = useState(false)
  const avatarClass = isToolNode(task.title) ? 'tl-avatar-blue' : 'tl-avatar-purple'
  const hasOutput = task.output_json != null

  let statusVariant: 'green' | 'blue' | 'red' | 'gray' = 'gray'
  if (task.status === 'success' || task.status === 'completed') statusVariant = 'green'
  else if (task.status === 'running') statusVariant = 'blue'
  else if (task.status === 'failed') statusVariant = 'red'

  return (
    <div className="timeline-item">
      <div className={`tl-avatar ${avatarClass}`}>{getAvatarText(task.title)}</div>
      <div className="tl-body">
        <div className="tl-header">
          <div className="tl-title">{task.title}</div>
          <Badge variant={statusVariant} dot={false}>{task.status}</Badge>
          {task.running_time > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--gray-400)' }}>{formatRuntime(task.running_time)}</span>
          )}
        </div>
        {task.summary && <div className="tl-summary">{task.summary}</div>}
        {hasOutput && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{ fontSize: 11.5, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 4 }}
          >
            {expanded ? '▲ Hide output' : '▼ Show output'}
          </button>
        )}
        {expanded && hasOutput && (
          <div className="tl-detail">
            {JSON.stringify(task.output_json as Record<string, unknown>, null, 2)}
          </div>
        )}
      </div>
    </div>
  )
}
