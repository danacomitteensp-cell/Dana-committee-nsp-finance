import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '../lib/formatters'
import {
  Receipt,
  Plus,
  ArrowDownRight,
  Filter,
  Search,
  Calendar,
} from 'lucide-react'

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchExpenses()
  }, [])

  async function fetchExpenses() {
    try {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*, account:financial_accounts(name), recorder:members!financial_transactions_recorded_by_fkey(full_name)')
        .eq('transaction_type', 'expense')
        .neq('status', 'void')
        .order('transaction_date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))]

  const filtered = expenses.filter(e => {
    if (filterCategory !== 'all' && e.category !== filterCategory) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        (e.description || '').toLowerCase().includes(term) ||
        (e.category || '').toLowerCase().includes(term) ||
        (e.account?.name || '').toLowerCase().includes(term)
      )
    }
    return true
  })

  const totalExpenses = filtered
    .filter(e => e.status === 'completed')
    .reduce((sum, e) => sum + Number(e.amount), 0)

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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Expenses</h1>
          <p className="text-gray-500 mt-1 text-sm">{filtered.length} expenses • Total: {formatCurrency(totalExpenses)}</p>
        </div>
        <Link
          to="/expenses/add"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-medium shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 transition-all duration-300 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
          >
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 md:p-12 text-center">
            <Receipt className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No expenses found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Category</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Description</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Account</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Method</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(ex => (
                    <tr key={ex.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(ex.transaction_date)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600">
                          {ex.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{ex.description || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{ex.account?.name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{PAYMENT_METHOD_LABELS[ex.payment_method] || '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-red-500">-{formatCurrency(Number(ex.amount))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map(ex => (
                <div key={ex.id} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ex.description || ex.category || 'Expense'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(ex.transaction_date)}
                      {ex.category && ` • ${ex.category}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-red-500 whitespace-nowrap">-{formatCurrency(Number(ex.amount))}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
