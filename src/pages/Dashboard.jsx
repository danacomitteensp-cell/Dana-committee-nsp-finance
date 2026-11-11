import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/StatCard'
import { formatCurrency, formatDate, TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS } from '../lib/formatters'
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock,
  Users,
  Banknote,
  Receipt,
  BarChart3,
  AlertCircle,
} from 'lucide-react'

export default function Dashboard() {
  const { member } = useAuth()
  const [summary, setSummary] = useState(null)
  const [recentTx, setRecentTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const [summaryRes, txRes] = await Promise.all([
        supabase.rpc('get_financial_summary'),
        supabase
          .from('financial_transactions')
          .select('*, member:members(full_name), account:financial_accounts(name)')
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      if (summaryRes.error) throw summaryRes.error
      setSummary(summaryRes.data)
      setRecentTx(txRes.data || [])
    } catch (err) {
      console.error('Error fetching dashboard:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-50 border border-red-100 text-center">
        <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
        <p className="text-red-600 font-medium">Failed to load dashboard</p>
        <p className="text-red-400 text-sm mt-1">{error}</p>
        <button onClick={() => { setError(''); setLoading(true); fetchDashboardData() }} className="mt-4 px-4 py-2 rounded-xl bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors">
          Retry
        </button>
      </div>
    )
  }

  const quickActions = [
    { to: '/lavazam', icon: Users, label: 'Record Payment', color: 'text-blue-600 bg-blue-50' },
    { to: '/collections/add', icon: Banknote, label: 'Add Collection', color: 'text-purple-600 bg-purple-50' },
    { to: '/expenses/add', icon: Receipt, label: 'Add Expense', color: 'text-red-500 bg-red-50' },
    { to: '/reports', icon: BarChart3, label: 'View Reports', color: 'text-emerald-600 bg-emerald-50' },
  ]

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Welcome back, {member?.full_name?.split(' ')[0]}</p>
        </div>
        <Link
          to="/transactions/add"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-medium shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 transition-all duration-300"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard
          icon={Wallet}
          label="Current Balance"
          value={formatCurrency(summary?.current_balance)}
          color="primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Income"
          value={formatCurrency(summary?.total_inflow)}
          color="green"
        />
        <StatCard
          icon={TrendingDown}
          label="Total Expenses"
          value={formatCurrency(summary?.total_expenses)}
          color="red"
        />
        <StatCard
          icon={IndianRupee}
          label="Outstanding Lavazam"
          value={formatCurrency(summary?.total_outstanding_lavazam)}
          color="amber"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(({ to, icon: Icon, label, color }) => (
            <Link
              key={to}
              to={to}
              className="card-hover flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-gray-100/80 text-center"
            >
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Account Balances */}
      {summary?.accounts?.length > 0 && (
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Account Balances</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {summary.accounts.map((acc) => (
              <div key={acc.id} className="card-hover bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{acc.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{acc.account_type}</p>
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-bold text-primary-900">{formatCurrency(Number(acc.balance))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Transactions Alert */}
      {(Number(summary?.pending_inflow) > 0 || Number(summary?.pending_outflow) > 0) && (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Pending Transactions</p>
              <p className="text-xs text-amber-600 mt-1">
                {Number(summary?.pending_inflow) > 0 && `Pending inflow: ${formatCurrency(summary.pending_inflow)}`}
                {Number(summary?.pending_inflow) > 0 && Number(summary?.pending_outflow) > 0 && ' • '}
                {Number(summary?.pending_outflow) > 0 && `Pending outflow: ${formatCurrency(summary.pending_outflow)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Recent Transactions
          </h2>
          <Link to="/transactions" className="text-sm text-primary-700 hover:text-primary-900 font-medium">
            View All →
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          {recentTx.length === 0 ? (
            <div className="p-8 md:p-12 text-center">
              <IndianRupee className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No transactions yet</p>
              <p className="text-gray-300 text-sm mt-1">Add your first transaction to get started</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Date</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Type</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Description</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Member</th>
                      <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDate(tx.transaction_date)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TRANSACTION_TYPE_COLORS[tx.transaction_type] || 'bg-gray-100 text-gray-600'}`}>
                            {TRANSACTION_TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium max-w-xs truncate">{tx.description || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{tx.member?.full_name || '—'}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center gap-1 text-sm font-semibold ${tx.direction === 'inflow' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.direction === 'inflow' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            {formatCurrency(Number(tx.amount))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-gray-50">
                {recentTx.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.direction === 'inflow' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {tx.direction === 'inflow' ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tx.description || TRANSACTION_TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(tx.transaction_date)}
                        {tx.member?.full_name && ` • ${tx.member.full_name}`}
                      </p>
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ${tx.direction === 'inflow' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.direction === 'inflow' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
