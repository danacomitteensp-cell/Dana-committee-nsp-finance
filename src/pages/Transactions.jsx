import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import {
  formatCurrency, formatDate,
  TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_COLORS, STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from '../lib/formatters'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

const PAGE_SIZE = 25

export default function Transactions() {
  const { isTreasurer } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)

  // Filters
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDirection, setFilterDirection] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Void modal
  const [voidModal, setVoidModal] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState('')
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    fetchTransactions()
  }, [page, filterType, filterStatus, filterDirection])

  async function fetchTransactions() {
    setLoading(true)
    setFetchError(null)
    try {
      let query = supabase
        .from('financial_transactions')
        .select('*, member:members!member_id(full_name), account:financial_accounts(name), fund:financial_funds(name)', { count: 'exact' })

      if (filterType !== 'all') query = query.eq('transaction_type', filterType)
      if (filterStatus !== 'all') query = query.eq('status', filterStatus)
      if (filterDirection !== 'all') query = query.eq('direction', filterDirection)

      query = query
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error
      setTransactions(data || [])
      setTotal(count || 0)
    } catch (err) {
      console.error('Error fetching transactions:', err)
      setFetchError(err.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const filtered = searchTerm
    ? transactions.filter(tx => {
        const term = searchTerm.toLowerCase()
        return (
          (tx.description || '').toLowerCase().includes(term) ||
          (tx.member?.full_name || '').toLowerCase().includes(term) ||
          (tx.category || '').toLowerCase().includes(term) ||
          (tx.reference_number || '').toLowerCase().includes(term)
        )
      })
    : transactions

  const totalPages = Math.ceil(total / PAGE_SIZE)

  async function handleVoid() {
    if (!voidModal) return
    setVoiding(true)
    setVoidError('')
    try {
      const { error } = await supabase.rpc('void_transaction', {
        p_transaction_id: voidModal.id,
        p_reason: voidReason || 'Correction',
      })
      if (error) throw error
      setVoidModal(null)
      setVoidReason('')
      await fetchTransactions()
    } catch (err) {
      setVoidError(err.message)
    } finally {
      setVoiding(false)
    }
  }

  if (loading && page === 0) {
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Transactions</h1>
          <p className="text-gray-500 mt-1 text-sm">{total} total transactions</p>
        </div>
        {isTreasurer && (
          <Link
            to="/transactions/add"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-medium shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 transition-all duration-300 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0) }}
            className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="all">All Types</option>
            <option value="lavazam">Lavazam</option>
            <option value="fund_collection">Collection</option>
            <option value="expense">Expense</option>
            <option value="refund">Refund</option>
            <option value="adjustment">Adjustment</option>
            <option value="joining">Joining</option>
          </select>
          <select
            value={filterDirection}
            onChange={(e) => { setFilterDirection(e.target.value); setPage(0) }}
            className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="all">All Directions</option>
            <option value="inflow">Inflow</option>
            <option value="outflow">Outflow</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(0) }}
            className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="void">Void</option>
          </select>
        </div>
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
          <button onClick={() => fetchTransactions()} className="ml-auto text-red-700 underline text-xs font-medium">Retry</button>
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
        {filtered.length === 0 && !fetchError ? (
          <div className="p-8 md:p-12 text-center">
            <ArrowLeftRight className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No transactions found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">Type</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">Description</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">Member</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">Account</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">Status</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-4">Amount</th>
                    {isTreasurer && (
                      <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-4"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className={`hover:bg-gray-50/50 transition-colors ${tx.status === 'void' ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(tx.transaction_date)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${TRANSACTION_TYPE_COLORS[tx.transaction_type] || 'bg-gray-100 text-gray-600'}`}>
                          {TRANSACTION_TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-900 max-w-[200px] truncate">{tx.description || '—'}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{tx.member?.full_name || '—'}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{tx.account?.name || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[tx.status] || 'bg-gray-100 text-gray-600'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 text-sm font-bold ${tx.direction === 'inflow' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.direction === 'inflow' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {tx.direction === 'inflow' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                        </span>
                      </td>
                      {isTreasurer && (
                        <td className="px-3 py-4 text-center">
                          {tx.status === 'completed' && (
                            <button
                              onClick={() => setVoidModal(tx)}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Void transaction"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map((tx) => (
                <div key={tx.id} className={`p-4 ${tx.status === 'void' ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.direction === 'inflow' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {tx.direction === 'inflow' ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tx.description || TRANSACTION_TYPE_LABELS[tx.transaction_type]}
                        </p>
                        {tx.status !== 'completed' && (
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[tx.status]}`}>
                            {tx.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDate(tx.transaction_date)}
                        <span className={`ml-2 ${TRANSACTION_TYPE_COLORS[tx.transaction_type]?.split(' ')[1] || 'text-gray-500'}`}>
                          {TRANSACTION_TYPE_LABELS[tx.transaction_type]}
                        </span>
                        {tx.member?.full_name && ` • ${tx.member.full_name}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-bold ${tx.direction === 'inflow' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.direction === 'inflow' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                      </span>
                      {isTreasurer && tx.status === 'completed' && (
                        <button
                          onClick={() => setVoidModal(tx)}
                          className="block ml-auto mt-1 p-1 rounded text-gray-300 hover:text-red-500"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-gray-50">
            <p className="text-xs text-gray-400">
              Page {page + 1} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Void Confirmation Modal */}
      <Modal open={!!voidModal} onClose={() => setVoidModal(null)} title="Void Transaction">
        {voidModal && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Are you sure you want to void this transaction?</p>
                  <p className="text-xs text-amber-600 mt-1">This will mark the transaction as void. It will not be deleted but will no longer count towards balances.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
              <p><span className="text-gray-500">Amount:</span> <span className="font-semibold">{formatCurrency(Number(voidModal.amount))}</span></p>
              <p><span className="text-gray-500">Type:</span> {TRANSACTION_TYPE_LABELS[voidModal.transaction_type]}</p>
              <p><span className="text-gray-500">Description:</span> {voidModal.description || '—'}</p>
            </div>

            {voidError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{voidError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for voiding"
                className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setVoidModal(null)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleVoid} disabled={voiding} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {voiding ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Void Transaction
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
