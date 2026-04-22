import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/ui/Toast'
import { Dashboard } from './pages/Dashboard'
import { NewRFQ } from './pages/NewRFQ'
import { QuotePipeline } from './pages/QuotePipeline'
import { QuoteBuilder } from './pages/QuoteBuilder'
import { QuotePreview } from './pages/QuotePreview'
import { QuoteEditForm } from './pages/QuoteEditForm'
import { QuoteConfirm } from './pages/QuoteConfirm'
import { EmailPreview } from './pages/EmailPreview'
import { HITLApprovals } from './pages/HITLApprovals'
import { ApprovalDetail } from './pages/ApprovalDetail'
import { ApprovalEmailReview } from './pages/ApprovalEmailReview'
import { EmailAuditTrail } from './pages/EmailAuditTrail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              {/* `/dashboard` alias — the sidebar link and most navigation
                  uses `/`, but some code paths / external links reach here. */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="new-rfq" element={<NewRFQ />} />
              <Route path="pipeline" element={<QuotePipeline />} />
              <Route path="pipeline/:jobId/quote" element={<QuoteBuilder />} />
              <Route path="pipeline/:jobId/quote/preview" element={<QuotePreview />} />
              <Route path="pipeline/:jobId/quote/edit" element={<QuoteEditForm />} />
              <Route path="pipeline/:jobId/quote/confirm" element={<QuoteConfirm />} />
              <Route path="pipeline/:jobId/email-preview" element={<EmailPreview />} />
              <Route path="approvals" element={<HITLApprovals />} />
              <Route path="approvals/:jobId" element={<ApprovalDetail />} />
              <Route path="approvals/:jobId/email" element={<ApprovalEmailReview />} />
              <Route path="audit" element={<EmailAuditTrail />} />
              <Route path="audit/:jobId" element={<EmailAuditTrail />} />
              {/* Unknown URLs inside the layout fall back to the dashboard
                  so a bad nav ('/dashboard', a stale bookmark, a typo in a
                  redirect) doesn't leave the user on a blank white page. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
