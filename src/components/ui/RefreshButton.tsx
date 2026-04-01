import { useState, useCallback } from 'react'

interface Props {
  onRefresh: () => void
  lastRefreshed?: Date
}

export function RefreshButton({ onRefresh, lastRefreshed }: Props) {
  const [spinning, setSpinning] = useState(false)

  const handleClick = useCallback(() => {
    setSpinning(false)
    // Force reflow so re-adding the class restarts the animation
    requestAnimationFrame(() => {
      setSpinning(true)
      onRefresh()
      setTimeout(() => setSpinning(false), 700)
    })
  }, [onRefresh])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {lastRefreshed && (
        <span style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
          {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
      <button
        onClick={handleClick}
        title="Refresh now"
        style={{
          background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6,
          padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: 'var(--gray-600)',
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}
      >
        <span className={spinning ? 'spin-once' : undefined} style={{ fontSize: 15, lineHeight: 1 }}>
          ↻
        </span>
        Refresh
      </button>
    </div>
  )
}
