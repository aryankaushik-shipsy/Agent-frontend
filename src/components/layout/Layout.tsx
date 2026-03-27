import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function Layout() {
  return (
    <>
      <Sidebar />
      <div id="main">
        <Topbar />
        <div id="content">
          <Outlet />
        </div>
      </div>
    </>
  )
}
