import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import { ToastProvider } from './components/ui/Toast'
import { Dashboard } from './pages/Dashboard'
import { NewRFQ } from './pages/NewRFQ'
import { QuotePipeline } from './pages/QuotePipeline'
import { QuoteBuilder } from './pages/QuoteBuilder'
import { QuotePreview } from './pages/QuotePreview'
import { EmailPreview } from './pages/EmailPreview'
import { HITLApprovals } from './pages/HITLApprovals'
import { ApprovalDetail } from './pages/ApprovalDetail'
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
              <Route path="new-rfq" element={<NewRFQ />} />
              <Route path="pipeline" element={<QuotePipeline />} />
              <Route path="pipeline/:jobId/quote" element={<QuoteBuilder />} />
              <Route path="pipeline/:jobId/quote/preview" element={<QuotePreview />} />
              <Route path="pipeline/:jobId/email-preview" element={<EmailPreview />} />
              <Route path="approvals" element={<HITLApprovals />} />
              <Route path="approvals/:jobId" element={<ApprovalDetail />} />
              <Route path="audit" element={<EmailAuditTrail />} />
              <Route path="audit/:jobId" element={<EmailAuditTrail />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
