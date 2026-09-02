import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { SignIn, SignUp } from '@clerk/react'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import RunsPage from '@/pages/RunsPage'
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
        {/* Auth pages — Custom Brand UI */}
        <Route
          path="/sign-in/*"
          element={
            <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
              <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-50 md:flex">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-zinc-900 to-zinc-950 z-0" />
                <div className="absolute inset-0 bg-[url('/logo.jpg')] bg-cover bg-center opacity-20 mix-blend-overlay z-0" />
                <div className="relative z-10 flex items-center gap-4 text-3xl font-bold">
                  <img src="/logo.jpg" alt="DATAClaw Logo" className="size-12 rounded-2xl shadow-xl ring-1 ring-white/20" />
                  DATAClaw
                </div>
                <div className="relative z-10 mt-auto">
                  <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Welcome back.
                  </h1>
                  <p className="max-w-md text-lg text-zinc-400">
                    Sign in to access your data reconciliation runs, manage discrepancies, and oversee your workflows.
                  </p>
                </div>
              </div>
              <div className="flex h-screen items-center justify-center bg-background p-4 relative">
                <div className="z-10 w-full max-w-md flex justify-center">
                  <SignIn
                    routing="path"
                    path="/sign-in"
                    signUpUrl="/sign-up"
                    fallbackRedirectUrl="/dashboard"
                  />
                </div>
              </div>
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
              <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-50 md:flex">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-zinc-900 to-zinc-950 z-0" />
                <div className="absolute inset-0 bg-[url('/logo.jpg')] bg-cover bg-center opacity-20 mix-blend-overlay z-0" />
                <div className="relative z-10 flex items-center gap-4 text-3xl font-bold">
                  <img src="/logo.jpg" alt="DATAClaw Logo" className="size-16 rounded-2xl shadow-xl ring-1 ring-white/20" />
                  DATAClaw
                </div>
                <div className="relative z-10 mt-auto">
                  <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Join DATAClaw.
                  </h1>
                  <p className="max-w-md text-lg text-zinc-400">
                    Create an account to start reconciling your data with unprecedented precision and ease.
                  </p>
                </div>
              </div>
              <div className="flex h-screen items-center justify-center bg-background p-4 relative">
                <div className="z-10 w-full max-w-md flex justify-center">
                  <SignUp
                    routing="path"
                    path="/sign-up"
                    signInUrl="/sign-in"
                    fallbackRedirectUrl="/dashboard"
                  />
                </div>
              </div>
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
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/discrepancies/:sessionId" element={<DiscrepanciesPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
