import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  Wallet,
  LogOut,
  IndianRupee,
  Banknote ,
  Receipt,
  BarChart3,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/lavazam', icon: Users, label: 'Lavazam' },
  { to: '/collections', icon: Banknote , label: 'Collections' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
]

export default function Sidebar({ open, onClose }) {
  const { member, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleNavClick = () => {
    onClose?.()
  }

  return (
    <>
      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-primary-900 to-primary-950 text-white flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Logo Area */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-200 flex items-center justify-center shadow-lg">
              <IndianRupee className="w-5 h-5 text-primary-900" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-primary-100">Dana Finance</h1>
              <p className="text-xs text-primary-300/70">Committee Manager</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-primary-300 hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary-200/20 text-primary-100 shadow-lg shadow-primary-950/20'
                    : 'text-primary-300/80 hover:bg-white/5 hover:text-primary-100'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-primary-200/20 flex items-center justify-center text-sm font-bold text-primary-200">
              {member?.full_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-100 truncate">
                {member?.full_name || 'User'}
              </p>
              <p className="text-xs text-primary-400/70">Treasurer</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm text-primary-300/80 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
