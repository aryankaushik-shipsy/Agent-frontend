import { useLocation, Link } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/new-rfq': 'New RFQ',
  '/pipeline': 'Quote Pipeline',
  '/approvals': 'HITL Approvals',
  '/audit': 'Email Audit Trail',
}

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/pipeline/') && pathname.endsWith('/quote')) return 'Quote Builder'
  if (pathname.startsWith('/pipeline/') && pathname.endsWith('/email-preview')) return 'Email Preview'
  if (pathname.startsWith('/audit/')) return 'Email Audit Trail'
  return 'Dashboard'
}

export function Topbar() {
  const location = useLocation()
  const title = getTitle(location.pathname)

  return (
    <header id="topbar">
      <div className="topbar-title">{title}</div>
      <Link to="/new-rfq" className="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        New RFQ
      </Link>
    </header>
  )
}
