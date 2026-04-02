import { NavLink } from 'react-router-dom'
import { useBadgeCounts } from '../../hooks/useBadgeCounts'

export function Sidebar() {
  const { pipelineCount, approvalsCount } = useBadgeCounts()

  return (
    <nav id="sidebar">
      <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1, padding: '0 18px' }}>
        {/* Aramex wordmark — brand red #C8342A, lowercase rounded sans-serif */}
        <svg viewBox="0 0 132 32" style={{ width: 110, height: 26, display: 'block' }} aria-label="Aramex">
          <text
            x="0" y="26"
            fontFamily="'Arial Rounded MT Bold', 'Arial', sans-serif"
            fontWeight="800"
            fontSize="28"
            fill="#C8342A"
            letterSpacing="-0.5"
          >
            aramex
          </text>
        </svg>
        <div className="sidebar-logo-sub" style={{ lineHeight: 1 }}>Freight AI</div>
      </div>

      <div className="nav-section-label">Navigation</div>

      <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
        Dashboard
      </NavLink>

      <NavLink to="/new-rfq" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
        </svg>
        New RFQ
      </NavLink>

      <NavLink to="/pipeline" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
        </svg>
        Quote Pipeline
      </NavLink>

      <NavLink to="/approvals" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        HITL Approvals
        {approvalsCount > 0 && <span className="nav-badge">{approvalsCount}</span>}
      </NavLink>

      <NavLink to="/audit" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
        </svg>
        Email Audit Trail
      </NavLink>
    </nav>
  )
}
