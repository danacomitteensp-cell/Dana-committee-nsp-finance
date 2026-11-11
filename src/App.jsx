import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Lavazam = lazy(() => import('./pages/Lavazam'))
const Collections = lazy(() => import('./pages/Collections'))
const AddCollection = lazy(() => import('./pages/AddCollection'))
const Expenses = lazy(() => import('./pages/Expenses'))
const AddExpense = lazy(() => import('./pages/AddExpense'))
const Transactions = lazy(() => import('./pages/Transactions'))
const AddTransaction = lazy(() => import('./pages/AddTransaction'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Reports = lazy(() => import('./pages/Reports'))
const AccessDenied = lazy(() => import('./pages/AccessDenied'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-primary-900/60 text-sm font-medium">Loading...</p>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { session, loading, isTreasurer } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-primary-900/60 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/access-denied"
          element={isTreasurer ? <Navigate to="/" replace /> : <AccessDenied />}
        />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lavazam" element={<Lavazam />} />
            <Route path="/member-fees" element={<Navigate to="/lavazam" replace />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/collections/add" element={<AddCollection />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expenses/add" element={<AddExpense />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/transactions/add" element={<AddTransaction />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
