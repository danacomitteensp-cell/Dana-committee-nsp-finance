import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../lib/formatters'
import { ArrowLeft, IndianRupee, Save, Loader2 } from 'lucide-react'

export default function AddCollection() {
  const { member } = useAuth()
  const navigate = useNavigate()

  const [funds, setFunds] = useState([])
  const [members, setMembers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    fund_id: '',
    amount: '',
    member_id: '',
    account_id: '',
    payment_method: 'upi',
    reference_number: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    async function load() {
      const [fundsRes, memRes, accRes] = await Promise.all([
        supabase.from('financial_funds').select('id, name').eq('is_active', true).order('name'),
        supabase.from('members').select('id, full_name').order('full_name'),
        supabase.from('financial_accounts').select('id, name').eq('is_active', true).order('name'),
      ])
      setFunds(fundsRes.data || [])
      setMembers(memRes.data || [])
      setAccounts(accRes.data || [])
    }
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('record_fund_collection', {
        p_fund_id: Number(form.fund_id),
        p_amount: Number(form.amount),
        p_account_id: form.account_id ? Number(form.account_id) : null,
        p_member_id: form.member_id ? Number(form.member_id) : null,
        p_payment_method: form.payment_method || null,
        p_reference_number: form.reference_number || null,
        p_description: form.description || null,
        p_transaction_date: form.transaction_date,
      })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/collections'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Add Collection</h1>
          <p className="text-gray-500 mt-1 text-sm">Record a fund contribution</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium">
          ✓ Collection recorded! Redirecting...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5 md:p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Fund <span className="text-red-400">*</span></label>
          <select value={form.fund_id} onChange={(e) => setForm(p => ({ ...p, fund_id: e.target.value }))} required className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300">
            <option value="">Select fund</option>
            {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount <span className="text-red-400">*</span></label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0" className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 text-lg font-semibold placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Contributing Member</label>
          <select value={form.member_id} onChange={(e) => setForm(p => ({ ...p, member_id: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300">
            <option value="">Select member (optional)</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account</label>
            <select value={form.account_id} onChange={(e) => setForm(p => ({ ...p, account_id: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300">
              <option value="">Select account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
            <select value={form.payment_method} onChange={(e) => setForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input type="date" value={form.transaction_date} onChange={(e) => setForm(p => ({ ...p, transaction_date: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference #</label>
            <input type="text" value={form.reference_number} onChange={(e) => setForm(p => ({ ...p, reference_number: e.target.value }))} placeholder="Optional" className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Optional notes" className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 resize-none" />
        </div>

        <button type="submit" disabled={loading || success} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-semibold shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 disabled:opacity-50 transition-all duration-300">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />Record Collection</>}
        </button>
      </form>
    </div>
  )
}
