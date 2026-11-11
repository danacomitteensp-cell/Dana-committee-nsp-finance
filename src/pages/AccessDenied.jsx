import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldX, LogOut, ArrowLeft } from 'lucide-react'

export default function AccessDenied() {
  const { signOut, member } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-primary-50 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100/50">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Access Denied</h1>
        <p className="text-gray-500 mb-2">
          Sorry <span className="font-semibold text-gray-700">{member?.full_name || 'User'}</span>,
          you don't have permission to access this application.
        </p>
        <p className="text-sm text-gray-400 mb-8">
          Only committee treasurers can manage finances. Contact your administrator if you believe this is an error.
        </p>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-900 text-white font-medium hover:bg-primary-800 transition-all shadow-lg shadow-primary-900/20"
        >
          <LogOut className="w-4 h-4" />
          Sign Out & Try Another Account
        </button>
      </div>
    </div>
  )
}
