import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { formatCurrency, formatDate, formatMonth, getDueStatus, DUE_STATUS_STYLES, PAYMENT_METHOD_LABELS } from '../lib/formatters'
import {
  Users,
  Check,
  X,
  Calendar,
  IndianRupee,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowLeft,
  Eye,
} from 'lucide-react'

export default function Lavazam() {
  const { member: currentMember } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [members, setMembers] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Year selector
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(Number(searchParams.get('year')) || currentYear)

  // Dues data: { [memberId]: { dues: [...], totalDue, totalPaid } }
  const [duesMap, setDuesMap] = useState({})

  // Generate dues state
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')

  // Payment modal
  const [paymentModal, setPaymentModal] = useState(null) // { memberId, memberName }
  const [accounts, setAccounts] = useState([])
  const [paymentForm, setPaymentForm] = useState({ amount: '', account_id: '', payment_method: 'upi', reference_number: '', description: '' })
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  // Detail modal
  const [detailModal, setDetailModal] = useState(null) // member dues detail
  const [detailLoading, setDetailLoading] = useState(false)

  // Search
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const [memRes, settingsRes, duesRes, accRes] = await Promise.all([
        supabase.from('members').select('id, full_name, is_active').order('full_name'),
        supabase.from('financial_settings').select('*').eq('id', true).single(),
        supabase
          .from('member_dues')
          .select('id, member_id, period_month, amount_due, due_date')
          .gte('period_month', `${selectedYear}-01-01`)
          .lte('period_month', `${selectedYear}-12-01`)
          .order('period_month'),
        supabase.from('financial_accounts').select('id, name, account_type').eq('is_active', true).order('name'),
      ])

      if (memRes.error) throw memRes.error
      setMembers(memRes.data || [])
      setSettings(settingsRes.data)
      setAccounts(accRes.data || [])

      const dues = duesRes.data || []

      // For each due, get allocations
      const dueIds = dues.map(d => d.id)
      let allocations = []
      if (dueIds.length > 0) {
        const { data: allocData } = await supabase
          .from('financial_transaction_allocations')
          .select('id, due_id, amount, transaction_id, transaction:financial_transactions(status)')
          .in('due_id', dueIds)

        allocations = (allocData || []).filter(a => a.transaction?.status === 'completed')
      }

      // Build dues map
      const map = {}
      for (const d of dues) {
        if (!map[d.member_id]) {
          map[d.member_id] = { dues: [], totalDue: 0, totalPaid: 0 }
        }
        const paid = allocations
          .filter(a => a.due_id === d.id)
          .reduce((sum, a) => sum + Number(a.amount), 0)
        map[d.member_id].dues.push({ ...d, amount_paid: paid })
        map[d.member_id].totalDue += Number(d.amount_due)
        map[d.member_id].totalPaid += paid
      }
      setDuesMap(map)
    } catch (err) {
      console.error('Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateDues() {
    if (!confirm(`Generate Lavazam dues for all members for ${selectedYear}?\n\nThis will create monthly dues for all members. It is safe to run multiple times — existing dues will not be duplicated.`)) return
    setGenerating(true)
    setGenerateMsg('')
    try {
      const { data, error } = await supabase.rpc('generate_lavazam_dues', { p_year: selectedYear })
      if (error) throw error
      setGenerateMsg(`✓ Generated ${data} new dues for ${selectedYear}`)
      await fetchData()
    } catch (err) {
      setGenerateMsg(`✗ Error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  function openPaymentModal(memberId, memberName) {
    const memberDues = duesMap[memberId]
    const outstanding = memberDues ? memberDues.totalDue - memberDues.totalPaid : 0
    setPaymentForm({
      amount: outstanding > 0 ? String(outstanding) : '',
      account_id: accounts[0]?.id || '',
      payment_method: 'upi',
      reference_number: '',
      description: '',
    })
    setPaymentError('')
    setPaymentModal({ memberId, memberName, outstanding })
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    setPaymentLoading(true)
    setPaymentError('')
    try {
      const { data, error } = await supabase.rpc('record_lavazam_payment', {
        p_member_id: paymentModal.memberId,
        p_amount: Number(paymentForm.amount),
        p_account_id: paymentForm.account_id ? Number(paymentForm.account_id) : null,
        p_payment_method: paymentForm.payment_method || null,
        p_reference_number: paymentForm.reference_number || null,
        p_description: paymentForm.description || null,
      })
      if (error) throw error
      setPaymentModal(null)
      await fetchData()
    } catch (err) {
      setPaymentError(err.message)
    } finally {
      setPaymentLoading(false)
    }
  }

  async function openDetailModal(memberId) {
    setDetailLoading(true)
    setDetailModal({ memberId, data: null })
    try {
      const { data, error } = await supabase.rpc('get_member_dues_detail', {
        p_member_id: memberId,
        p_year: selectedYear,
      })
      if (error) throw error
      setDetailModal({ memberId, data })
    } catch (err) {
      setDetailModal({ memberId, error: err.message })
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members
    const term = searchTerm.toLowerCase()
    return members.filter(m => m.full_name.toLowerCase().includes(term))
  }, [members, searchTerm])

  // Summary stats
  const totalDuesGenerated = Object.values(duesMap).reduce((s, m) => s + m.totalDue, 0)
  const totalCollected = Object.values(duesMap).reduce((s, m) => s + m.totalPaid, 0)
  const totalOutstanding = totalDuesGenerated - totalCollected
  const membersWithDues = Object.keys(duesMap).length

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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Lavazam</h1>
          <p className="text-gray-500 mt-1 text-sm">Track and manage monthly member contributions</p>
        </div>
        <button
          onClick={handleGenerateDues}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-900 to-primary-800 text-white font-medium shadow-lg shadow-primary-900/20 hover:shadow-xl hover:from-primary-800 hover:to-primary-700 disabled:opacity-50 transition-all duration-300"
        >
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
          Generate Dues
        </button>
      </div>

      {generateMsg && (
        <div className={`p-3 rounded-xl text-sm font-medium ${generateMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {generateMsg}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Year */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                const y = Number(e.target.value)
                setSelectedYear(y)
                setSearchParams({ year: y })
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Search Member</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex gap-2 sm:col-span-2">
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-lg md:text-xl font-bold text-emerald-700">{formatCurrency(totalCollected)}</p>
              <p className="text-xs text-emerald-600 font-medium">Collected</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
              <p className="text-lg md:text-xl font-bold text-red-500">{formatCurrency(totalOutstanding)}</p>
              <p className="text-xs text-red-400 font-medium">Outstanding</p>
            </div>
            <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-lg md:text-xl font-bold text-blue-700">{membersWithDues}</p>
              <p className="text-xs text-blue-600 font-medium">Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Members List */}
      {membersWithDues === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 p-8 md:p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No dues generated for {selectedYear}</p>
          <p className="text-gray-300 text-sm mt-1">Click "Generate Dues" to create monthly obligations</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Member</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-4">
                      {new Date(selectedYear, i).toLocaleDateString('en-IN', { month: 'short' })}
                    </th>
                  ))}
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-4">Due</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-4">Paid</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMembers.map((m) => {
                  const data = duesMap[m.id]
                  if (!data) return null
                  const outstanding = data.totalDue - data.totalPaid

                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                            {m.full_name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900">{m.full_name}</span>
                            {!m.is_active && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}-01`
                        const due = data.dues.find(d => d.period_month === monthStr)
                        if (!due) return <td key={i} className="px-2 py-3 text-center"><span className="text-xs text-gray-300">—</span></td>
                        const status = getDueStatus(due.amount_due, due.amount_paid)
                        const s = DUE_STATUS_STYLES[status]
                        return (
                          <td key={i} className="px-2 py-3 text-center">
                            <span className={`inline-block w-6 h-6 rounded-full text-[10px] font-bold leading-6 ${s.bg} ${s.text}`} title={`${s.label}: ₹${due.amount_paid}/${due.amount_due}`}>
                              {status === 'paid' ? '✓' : status === 'partial' ? '½' : '✗'}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{formatCurrency(data.totalDue)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">{formatCurrency(data.totalPaid)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetailModal(m.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {outstanding > 0 && (
                            <button
                              onClick={() => openPaymentModal(m.id, m.full_name)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              Add Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-gray-50">
            {filteredMembers.map((m) => {
              const data = duesMap[m.id]
              if (!data) return null
              const outstanding = data.totalDue - data.totalPaid
              const overallStatus = outstanding <= 0 ? 'paid' : data.totalPaid > 0 ? 'partial' : 'unpaid'
              const s = DUE_STATUS_STYLES[overallStatus]

              return (
                <div key={m.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700 shrink-0">
                        {m.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                        {!m.is_active && <p className="text-xs text-gray-400">Inactive</p>}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${s.bg} ${s.text}`}>
                      {s.label}
                    </span>
                  </div>

                  {/* Month indicators */}
                  <div className="grid grid-cols-12 gap-1 mb-3">
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}-01`
                      const due = data.dues.find(d => d.period_month === monthStr)
                      if (!due) return <div key={i} className="h-2 rounded-full bg-gray-100" />
                      const st = getDueStatus(due.amount_due, due.amount_paid)
                      const colors = { paid: 'bg-emerald-400', partial: 'bg-amber-400', unpaid: 'bg-red-300' }
                      return <div key={i} className={`h-2 rounded-full ${colors[st]}`} title={new Date(selectedYear, i).toLocaleDateString('en-IN', { month: 'short' })} />
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-xs">
                      <span className="text-gray-500">Due: <span className="font-semibold text-gray-700">{formatCurrency(data.totalDue)}</span></span>
                      <span className="text-emerald-600">Paid: <span className="font-semibold">{formatCurrency(data.totalPaid)}</span></span>
                      {outstanding > 0 && (
                        <span className="text-red-500">Left: <span className="font-semibold">{formatCurrency(outstanding)}</span></span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openDetailModal(m.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {outstanding > 0 && (
                        <button
                          onClick={() => openPaymentModal(m.id, m.full_name)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal
        open={!!paymentModal}
        onClose={() => setPaymentModal(null)}
        title={`Record Payment — ${paymentModal?.memberName}`}
      >
        {paymentModal && (
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {paymentModal.outstanding > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
                Outstanding: <span className="font-bold">{formatCurrency(paymentModal.outstanding)}</span>
              </div>
            )}

            {paymentError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{paymentError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount <span className="text-red-400">*</span></label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                  required
                  placeholder="0"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 text-lg font-semibold placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account</label>
              <select
                value={paymentForm.account_id}
                onChange={(e) => setPaymentForm(p => ({ ...p, account_id: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              >
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
              <select
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Number</label>
              <input
                type="text"
                value={paymentForm.reference_number}
                onChange={(e) => setPaymentForm(p => ({ ...p, reference_number: e.target.value }))}
                placeholder="Transaction ID / Receipt #"
                className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
              <input
                type="text"
                value={paymentForm.description}
                onChange={(e) => setPaymentForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional note"
                className="w-full px-4 py-3 rounded-xl bg-gray-50/80 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              />
            </div>

            <button
              type="submit"
              disabled={paymentLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {paymentLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Record Payment
                </>
              )}
            </button>
          </form>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title={detailModal?.data?.member_name ? `${detailModal.data.member_name} — ${selectedYear}` : 'Member Dues'}
        maxWidth="max-w-2xl"
      >
        {detailModal && (
          <div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : detailModal.error ? (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{detailModal.error}</div>
            ) : detailModal.data?.dues?.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No dues found for this year</p>
            ) : (
              <div className="space-y-3">
                {detailModal.data?.dues?.map((due) => {
                  const status = getDueStatus(due.amount_due, due.amount_paid)
                  const s = DUE_STATUS_STYLES[status]
                  return (
                    <div key={due.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">{formatMonth(due.period_month)}</span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500 mb-2">
                        <span>Due: <span className="font-medium text-gray-700">{formatCurrency(due.amount_due)}</span></span>
                        <span>Paid: <span className="font-medium text-emerald-600">{formatCurrency(due.amount_paid)}</span></span>
                        {due.amount_due - due.amount_paid > 0 && (
                          <span>Left: <span className="font-medium text-red-500">{formatCurrency(due.amount_due - due.amount_paid)}</span></span>
                        )}
                      </div>
                      {due.allocations?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                          {due.allocations.map((a) => (
                            <div key={a.id} className="flex justify-between text-xs text-gray-500">
                              <span>{formatDate(a.transaction_date)} • {PAYMENT_METHOD_LABELS[a.payment_method] || a.payment_method || '—'}</span>
                              <span className="font-medium text-emerald-600">{formatCurrency(a.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
