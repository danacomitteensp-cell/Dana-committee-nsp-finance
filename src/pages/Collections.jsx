import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { formatCurrency, formatDate, FUND_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '../lib/formatters'
import {
  Banknote ,
  Plus,
  Loader2,
  IndianRupee,
  Calendar,
  Target,
  ArrowUpRight,
  X,
} from 'lucide-react'

export default function Collections() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const [funds, setFunds] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Create fund modal
  const [showCreate, setShowCreate] = useState(false)
  const [fundForm, setFundForm] = useState({ name: '', fund_type: 'event', description: '', target_amount: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setFetchError(null)
    try {
      const [fundsRes, txRes] = await Promise.all([
        supabase.from('financial_funds').select('*').order('created_at', { ascending: false }),
        supabase
          .from('financial_transactions')
          .select('*, member:members!member_id(full_name), account:financial_accounts(name), fund:financial_funds(name)')
          .eq('transaction_type', 'fund_collection')
          .eq('status', 'completed')
          .order('transaction_date', { ascending: false })
          .limit(50),
      ])

      if (fundsRes.error) throw fundsRes.error
      if (txRes.error) throw txRes.error

      setFunds(fundsRes.data || [])
      setTransactions(txRes.data || [])
    } catch (err) {
      console.error('Error fetching collections data:', err)
      setFetchError(err.message || 'Failed to load collections data')
    } finally {
      setLoading(false)
    }
  }

  // Calculate fund totals from transactions
  function getFundTotal(fundId) {
    return transactions
      .filter(t => t.fund_id === fundId)
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }

  async function handleCreateFund(e) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const { error } = await supabase.from('financial_funds').insert({
        name: fundForm.name,
        fund_type: fundForm.fund_type,
        description: fundForm.description || null,
        target_amount: fundForm.target_amount ? Number(fundForm.target_amount) : null,
      })
      if (error) throw error
      setShowCreate(false)
      setFundForm({ name: '', fund_type: 'event', description: '', target_amount: '' })
      await fetchData()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Collections</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage funds and contributions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium hover:border-gray-300 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            New Fund
          </button>
          <Link
            to="/collections/add"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-medium shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 transition-all duration-300 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Collection
          </Link>
        </div>
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
          <span>⚠ {fetchError}</span>
          <button onClick={() => fetchData()} className="ml-auto text-red-700 underline text-xs font-medium">Retry</button>
        </div>
      )}

      {/* Funds Grid */}
      {funds.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-8 md:p-12 text-center">
          <Banknote  className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No funds created yet</p>
          <p className="text-gray-300 text-sm mt-1">Create a fund to start collecting</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {funds.map((fund) => {
            const collected = getFundTotal(fund.id)
            const progress = fund.target_amount ? Math.min((collected / fund.target_amount) * 100, 100) : null

            return (
              <div key={fund.id} className="card-hover bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Banknote  className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${fund.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {fund.is_active ? 'Active' : 'Closed'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1 truncate">{fund.name}</h3>
                <p className="text-xs text-gray-400 mb-3 capitalize">{FUND_TYPE_LABELS[fund.fund_type] || fund.fund_type}</p>
                {fund.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{fund.description}</p>}

                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-end justify-between mb-1">
                    <span className="text-sm text-gray-500">Collected</span>
                    {fund.target_amount && (
                      <span className="text-xs text-gray-400">Target: {formatCurrency(fund.target_amount)}</span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-purple-700">{formatCurrency(collected)}</p>

                  {progress !== null && (
                    <div className="mt-2">
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{Math.round(progress)}% of target</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Collection Transactions */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Recent Contributions</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Fund</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Member</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Description</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(tx.transaction_date)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-purple-700">{tx.fund?.name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{tx.member?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{tx.description || '—'}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">+{formatCurrency(Number(tx.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-gray-50">
              {transactions.map(tx => (
                <div key={tx.id} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tx.fund?.name || 'Collection'}</p>
                    <p className="text-xs text-gray-400">{formatDate(tx.transaction_date)}{tx.member?.full_name && ` • ${tx.member.full_name}`}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">+{formatCurrency(Number(tx.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Fund Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Fund">
        <form onSubmit={handleCreateFund} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{createError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fund Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={fundForm.name}
              onChange={(e) => setFundForm(p => ({ ...p, name: e.target.value }))}
              required
              placeholder="e.g., Trip Fund, Event Collection"
              className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <select
              value={fundForm.fund_type}
              onChange={(e) => setFundForm(p => ({ ...p, fund_type: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            >
              <option value="event">Event</option>
              <option value="trip">Trip</option>
              <option value="emergency">Emergency</option>
              <option value="special">Special</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={fundForm.description}
              onChange={(e) => setFundForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Optional description"
              className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Amount</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                min="0"
                value={fundForm.target_amount}
                onChange={(e) => setFundForm(p => ({ ...p, target_amount: e.target.value }))}
                placeholder="Optional"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-semibold shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 disabled:opacity-50 transition-all"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Create Fund
          </button>
        </form>
      </Modal>
    </div>
  )
}
