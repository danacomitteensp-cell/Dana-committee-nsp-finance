import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeft, IndianRupee, Save, Loader2, Upload } from 'lucide-react'

export default function AddExpense() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    amount: '',
    category: '',
    description: '',
    account_id: '',
    payment_method: 'cash',
    reference_number: '',
    transaction_date: new Date().toISOString().split('T')[0],
  })

  const [receiptFile, setReceiptFile] = useState(null)

  const categories = ['Food', 'Transport', 'Venue', 'Supplies', 'Printing', 'Decoration', 'Utilities', 'Maintenance', 'Donation', 'Other']

  useEffect(() => {
    supabase.from('financial_accounts').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setAccounts(data || []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('record_expense', {
        p_amount: Number(form.amount),
        p_account_id: form.account_id ? Number(form.account_id) : null,
        p_category: form.category || null,
        p_description: form.description || null,
        p_payment_method: form.payment_method || null,
        p_reference_number: form.reference_number || null,
        p_transaction_date: form.transaction_date,
      })
      if (rpcErr) throw rpcErr

      // Upload receipt if provided
      if (receiptFile && data?.transaction_id) {
        const ext = receiptFile.name.split('.').pop()
        const path = `receipts/${data.transaction_id}_${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('financial-receipts')
          .upload(path, receiptFile)

        if (!uploadErr) {
          // Record attachment metadata
          await supabase.from('financial_attachments').insert({
            transaction_id: data.transaction_id,
            file_name: receiptFile.name,
            storage_path: path,
            content_type: receiptFile.type,
          })
        }
        // Don't fail the whole operation if upload fails
      }

      setSuccess(true)
      setTimeout(() => navigate('/expenses'), 1500)
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Add Expense</h1>
          <p className="text-gray-500 mt-1 text-sm">Record an expense transaction</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium">
          ✓ Expense recorded! Redirecting...
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-5 md:p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount <span className="text-red-400">*</span></label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0" className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 text-lg font-semibold placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-400">*</span></label>
          <select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} required className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300">
            <option value="">Select category</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-400">*</span></label>
          <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} required rows={2} placeholder="What was this expense for?" className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 resize-none" />
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

        {/* Receipt Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Receipt / Bill</label>
          <label className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-gray-500 hover:border-primary-300 hover:text-primary-700 transition-colors cursor-pointer">
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">
              {receiptFile ? receiptFile.name : 'Upload receipt (optional)'}
            </span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <button type="submit" disabled={loading || success} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-semibold shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 disabled:opacity-50 transition-all duration-300">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />Record Expense</>}
        </button>
      </form>
    </div>
  )
}
