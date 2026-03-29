import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ErrorBoundary } from '../ui/ErrorBoundary'

export function Layout() {
  return (
    <>
      <Sidebar />
      <div id="main">
        <Topbar />
        <div id="content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </>
  )
}
