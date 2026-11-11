import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '../lib/formatters'
import { Wallet, Plus, X, Loader2 } from 'lucide-react'

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', account_type: 'cash', opening_balance: '0' })

  // Computed balances from transactions
  const [balances, setBalances] = useState({})

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    try {
      const [accRes, txRes] = await Promise.all([
        supabase.from('financial_accounts').select('*').order('created_at', { ascending: false }),
        supabase
          .from('financial_transactions')
          .select('account_id, direction, amount')
          .eq('status', 'completed')
          .not('account_id', 'is', null),
      ])

      if (accRes.error) throw accRes.error
      setAccounts(accRes.data || [])

      // Compute balances
      const bals = {}
      for (const acc of accRes.data || []) {
        bals[acc.id] = Number(acc.opening_balance) || 0
      }
      for (const tx of txRes.data || []) {
        if (bals[tx.account_id] !== undefined) {
          bals[tx.account_id] += tx.direction === 'inflow' ? Number(tx.amount) : -Number(tx.amount)
        }
      }
      setBalances(bals)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { error: insertError } = await supabase
        .from('financial_accounts')
        .insert({
          name: form.name,
          account_type: form.account_type,
          opening_balance: Number(form.opening_balance) || 0,
          opening_balance_date: new Date().toISOString().split('T')[0],
        })
      if (insertError) throw insertError
      setForm({ name: '', account_type: 'cash', opening_balance: '0' })
      setShowForm(false)
      await fetchAccounts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Accounts</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage your finance accounts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-medium shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 transition-all duration-300"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {/* Add Account Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Account</h2>
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Cash, Bank" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                <input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} min="0" className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 text-sm" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Account
            </button>
          </form>
        </div>
      )}

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-8 md:p-12 text-center">
          <Wallet className="w-12 h-12 md:w-16 md:h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-base md:text-lg">No accounts yet</p>
          <p className="text-gray-300 text-sm mt-1">Create your first account to start tracking finances</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {accounts.map((acc) => {
            const balance = balances[acc.id] ?? Number(acc.opening_balance)
            return (
              <div key={acc.id} className="card-hover bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100/80">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center shadow-sm">
                    <Wallet className="w-6 h-6 text-primary-800" />
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${acc.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {acc.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{acc.name}</h3>
                <p className="text-xs text-gray-400 capitalize mb-4">{ACCOUNT_TYPE_LABELS[acc.account_type] || acc.account_type}</p>
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">Balance</p>
                  <p className="text-2xl font-bold text-primary-900">{formatCurrency(balance)}</p>
                </div>
                <p className="text-xs text-gray-300 mt-3">
                  Created {new Date(acc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
