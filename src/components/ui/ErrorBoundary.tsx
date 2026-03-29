import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="banner banner-yellow" style={{ margin: 24 }}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <div className="banner-content">
            <div className="banner-title">Something went wrong rendering this page</div>
            <div style={{ fontSize: 12, marginTop: 4, fontFamily: 'monospace', opacity: .8 }}>
              {this.state.error.message}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
