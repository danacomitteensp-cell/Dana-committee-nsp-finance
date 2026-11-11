import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, IndianRupee, Save, Loader2 } from 'lucide-react'

export default function AddTransaction() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [funds, setFunds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    transaction_type: 'lavazam',
    direction: 'inflow',
    amount: '',
    member_id: '',
    account_id: '',
    fund_id: '',
    category: '',
    description: '',
    payment_method: 'cash',
    reference_number: '',
    status: 'completed',
    transaction_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    async function load() {
      const [memRes, accRes, fundRes] = await Promise.all([
        supabase.from('members').select('id, full_name').order('full_name'),
        supabase.from('financial_accounts').select('id, name').eq('is_active', true).order('name'),
        supabase.from('financial_funds').select('id, name').eq('is_active', true).order('name'),
      ])
      setMembers(memRes.data || [])
      setAccounts(accRes.data || [])
      setFunds(fundRes.data || [])
    }
    load()
  }, [])

  // Auto-set direction based on type
  useEffect(() => {
    const directionMap = {
      lavazam: 'inflow',
      fund_collection: 'inflow',
      expense: 'outflow',
      refund: 'outflow',
      adjustment: form.direction,
    }
    if (directionMap[form.transaction_type] !== undefined) {
      setForm(p => ({ ...p, direction: directionMap[form.transaction_type] }))
    }
  }, [form.transaction_type])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        transaction_type: form.transaction_type,
        direction: form.direction,
        amount: Number(form.amount),
        transaction_date: form.transaction_date,
        account_id: form.account_id ? Number(form.account_id) : null,
        member_id: form.member_id ? Number(form.member_id) : null,
        fund_id: form.fund_id ? Number(form.fund_id) : null,
        category: form.category || null,
        description: form.description || null,
        payment_method: form.payment_method || null,
        reference_number: form.reference_number || null,
        status: form.status,
        recorded_by: member?.id || null,
      }

      const { error: insertError } = await supabase
        .from('financial_transactions')
        .insert(payload)

      if (insertError) throw insertError
      setSuccess(true)
      setTimeout(() => navigate('/transactions'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Add Transaction</h1>
          <p className="text-gray-500 mt-1 text-sm">Record a financial transaction</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium">
          ✓ Transaction added! Redirecting...
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5 md:p-8 space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount <span className="text-red-400">*</span></label>
          <div className="relative">
            <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={handleChange} required placeholder="0.00" className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 text-lg font-semibold placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300" />
          </div>
        </div>

        {/* Type */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type <span className="text-red-400">*</span></label>
            <select name="transaction_type" value={form.transaction_type} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="lavazam">Lavazam</option>
              <option value="fund_collection">Collection</option>
              <option value="expense">Expense</option>
              <option value="refund">Refund</option>
              <option value="adjustment">Adjustment</option>
              <option value="Joining">Joining</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Direction</label>
            <select name="direction" value={form.direction} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="inflow">Inflow</option>
              <option value="outflow">Outflow</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Member & Account */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Member</label>
            <select name="member_id" value={form.member_id} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="">Select member</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account</label>
            <select name="account_id" value={form.account_id} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="">Select account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {/* Fund (for collections) */}
        {form.transaction_type === 'fund_collection' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fund</label>
            <select name="fund_id" value={form.fund_id} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="">Select fund</option>
              {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {/* Category, Payment Method, Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <input name="category" type="text" value={form.category} onChange={handleChange} placeholder="e.g., Food, Transport" className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
            <select name="payment_method" value={form.payment_method} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              {/* <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option> */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input name="transaction_date" type="date" value={form.transaction_date} onChange={handleChange} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
        </div>

        {/* Reference & Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Number</label>
          <input name="reference_number" type="text" value={form.reference_number} onChange={handleChange} placeholder="Optional" className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={2} placeholder="Optional notes..." className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
        </div>

        <button type="submit" disabled={loading || success} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-semibold shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 disabled:opacity-50 transition-all duration-300">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />Save Transaction</>}
        </button>
      </form>
    </div>
  )
}
