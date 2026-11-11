import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { session, member, isTreasurer, loading } = useAuth()

  if (loading) return null

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!member || !isTreasurer) {
    return <Navigate to="/access-denied" replace />
  }

  return <Outlet />
}
