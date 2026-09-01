import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { SignIn, SignUp } from '@clerk/react'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import UploadPage from '@/pages/UploadPage'
import DiscrepanciesPage from '@/pages/DiscrepanciesPage'

// Protected route — redirects to /sign-in if not authenticated
function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading DATAClaw…</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages — Clerk hosted UI */}
        <Route
          path="/sign-in/*"
          element={
            <div className="flex h-screen items-center justify-center bg-background">
              <SignIn routing="path" path="/sign-in" afterSignInUrl="/dashboard" />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="flex h-screen items-center justify-center bg-background">
              <SignUp routing="path" path="/sign-up" afterSignUpUrl="/dashboard" />
            </div>
          }
        />

        {/* Protected app routes — wrapped in sidebar layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/discrepancies/:sessionId" element={<DiscrepanciesPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
