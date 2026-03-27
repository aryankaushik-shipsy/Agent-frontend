import type { ReactNode } from 'react'

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'

interface BadgeProps {
  variant: BadgeVariant
  dot?: boolean
  children: ReactNode
}

export function Badge({ variant, dot = true, children }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}
