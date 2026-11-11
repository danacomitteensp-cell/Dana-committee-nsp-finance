import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  formatCurrency, formatDate, formatMonth,
  TRANSACTION_TYPE_LABELS, PAYMENT_METHOD_LABELS,
  generateCSV, downloadCSV,
} from '../lib/formatters'
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  Filter,
} from 'lucide-react'

export default function Reports() {
  const [transactions, setTransactions] = useState([])
  const [members, setMembers] = useState([])
  const [dues, setDues] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear()
  const [reportYear, setReportYear] = useState(currentYear)
  const [reportType, setReportType] = useState('monthly')

  useEffect(() => {
    fetchReportData()
  }, [reportYear])

  async function fetchReportData() {
    setLoading(true)
    try {
      const startDate = `${reportYear}-01-01`
      const endDate = `${reportYear}-12-31`

      const [txRes, memRes, duesRes, allocRes] = await Promise.all([
        supabase
          .from('financial_transactions')
          .select('*')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate)
          .eq('status', 'completed')
          .order('transaction_date'),
        supabase.from('members').select('id, full_name, is_active').order('full_name'),
        supabase
          .from('member_dues')
          .select('*')
          .gte('period_month', `${reportYear}-01-01`)
          .lte('period_month', `${reportYear}-12-01`),
        supabase
          .from('financial_transaction_allocations')
          .select('*, transaction:financial_transactions(status, transaction_date)')
      ])

      setTransactions(txRes.data || [])
      setMembers(memRes.data || [])
      setDues(duesRes.data || [])
      setAllocations((allocRes.data || []).filter(a => a.transaction?.status === 'completed'))
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthTx = transactions.filter(tx => {
        const m = new Date(tx.transaction_date).getMonth()
        return m === i
      })
      const inflow = monthTx.filter(t => t.direction === 'inflow').reduce((s, t) => s + Number(t.amount), 0)
      const outflow = monthTx.filter(t => t.direction === 'outflow').reduce((s, t) => s + Number(t.amount), 0)
      return {
        month: new Date(reportYear, i).toLocaleDateString('en-IN', { month: 'long' }),
        monthShort: new Date(reportYear, i).toLocaleDateString('en-IN', { month: 'short' }),
        inflow,
        outflow,
        net: inflow - outflow,
      }
    })
    return months
  }, [transactions, reportYear])

  // Lavazam summary per member
  const lavazamSummary = useMemo(() => {
    return members.map(m => {
      const memberDues = dues.filter(d => d.member_id === m.id)
      const totalDue = memberDues.reduce((s, d) => s + Number(d.amount_due), 0)
      const totalPaid = memberDues.reduce((s, d) => {
        const paid = allocations.filter(a => a.due_id === d.id).reduce((ss, a) => ss + Number(a.amount), 0)
        return s + paid
      }, 0)
      return {
        id: m.id,
        name: m.full_name,
        is_active: m.is_active,
        totalDue,
        totalPaid,
        outstanding: totalDue - totalPaid,
      }
    }).filter(m => m.totalDue > 0)
  }, [members, dues, allocations])

  // Category-wise expenses
  const expenseByCategory = useMemo(() => {
    const map = {}
    transactions
      .filter(t => t.transaction_type === 'expense')
      .forEach(t => {
        const cat = t.category || 'Uncategorized'
        map[cat] = (map[cat] || 0) + Number(t.amount)
      })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [transactions])

  // Totals
  const totalInflow = transactions.filter(t => t.direction === 'inflow').reduce((s, t) => s + Number(t.amount), 0)
  const totalOutflow = transactions.filter(t => t.direction === 'outflow').reduce((s, t) => s + Number(t.amount), 0)
  const totalLavazamDue = lavazamSummary.reduce((s, m) => s + m.totalDue, 0)
  const totalLavazamPaid = lavazamSummary.reduce((s, m) => s + m.totalPaid, 0)

  function exportMonthlyCSV() {
    const csv = generateCSV(monthlySummary, [
      { label: 'Month', accessor: 'month' },
      { label: 'Inflow', accessor: 'inflow' },
      { label: 'Outflow', accessor: 'outflow' },
      { label: 'Net', accessor: 'net' },
    ])
    downloadCSV(csv, `monthly-report-${reportYear}.csv`)
  }

  function exportLavazamCSV() {
    const csv = generateCSV(lavazamSummary, [
      { label: 'Member', accessor: 'name' },
      { label: 'Status', accessor: r => r.is_active ? 'Active' : 'Inactive' },
      { label: 'Total Due', accessor: 'totalDue' },
      { label: 'Total Paid', accessor: 'totalPaid' },
      { label: 'Outstanding', accessor: 'outstanding' },
    ])
    downloadCSV(csv, `lavazam-report-${reportYear}.csv`)
  }

  function exportExpenseCSV() {
    const expenseTx = transactions.filter(t => t.transaction_type === 'expense')
    const csv = generateCSV(expenseTx, [
      { label: 'Date', accessor: 'transaction_date' },
      { label: 'Category', accessor: r => r.category || 'Uncategorized' },
      { label: 'Description', accessor: r => r.description || '' },
      { label: 'Amount', accessor: 'amount' },
      { label: 'Payment Method', accessor: r => PAYMENT_METHOD_LABELS[r.payment_method] || r.payment_method || '' },
    ])
    downloadCSV(csv, `expense-report-${reportYear}.csv`)
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-gray-500 mt-1 text-sm">Financial reports and analytics</p>
        </div>
        <select
          value={reportYear}
          onChange={(e) => setReportYear(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 shadow-sm"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-gray-500">Total Inflow</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-emerald-600">{formatCurrency(totalInflow)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-gray-500">Total Outflow</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-red-500">{formatCurrency(totalOutflow)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-medium text-gray-500">Net Balance</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-primary-900">{formatCurrency(totalInflow - totalOutflow)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100/80">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-gray-500">Lavazam Outstanding</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-amber-600">{formatCurrency(totalLavazamDue - totalLavazamPaid)}</p>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-50">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Monthly Summary
          </h2>
          <button onClick={exportMonthlyCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Month</th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase px-5 py-3">Inflow</th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase px-5 py-3">Outflow</th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase px-5 py-3">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {monthlySummary.map((m, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{m.month}</td>
                  <td className="px-5 py-3 text-sm text-right text-emerald-600 font-medium">{m.inflow > 0 ? formatCurrency(m.inflow) : '—'}</td>
                  <td className="px-5 py-3 text-sm text-right text-red-500 font-medium">{m.outflow > 0 ? formatCurrency(m.outflow) : '—'}</td>
                  <td className={`px-5 py-3 text-sm text-right font-bold ${m.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {m.inflow > 0 || m.outflow > 0 ? formatCurrency(m.net) : '—'}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50/80 font-bold">
                <td className="px-5 py-3 text-sm text-gray-900">Total</td>
                <td className="px-5 py-3 text-sm text-right text-emerald-600">{formatCurrency(totalInflow)}</td>
                <td className="px-5 py-3 text-sm text-right text-red-500">{formatCurrency(totalOutflow)}</td>
                <td className={`px-5 py-3 text-sm text-right ${totalInflow - totalOutflow >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(totalInflow - totalOutflow)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-gray-50">
          {monthlySummary.filter(m => m.inflow > 0 || m.outflow > 0).map((m, i) => (
            <div key={i} className="p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">{m.month}</p>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-600">In: <span className="font-semibold">{formatCurrency(m.inflow)}</span></span>
                <span className="text-red-500">Out: <span className="font-semibold">{formatCurrency(m.outflow)}</span></span>
                <span className={`font-bold ${m.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>Net: {formatCurrency(m.net)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expense by Category */}
      {expenseByCategory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Expenses by Category</h2>
            <button onClick={exportExpenseCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <Download className="w-3.5 h-3.5" />CSV
            </button>
          </div>
          <div className="p-4 md:p-5 space-y-3">
            {expenseByCategory.map(([cat, amount]) => {
              const pct = totalOutflow > 0 ? (amount / totalOutflow) * 100 : 0
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat}</span>
                    <span className="text-sm font-bold text-red-500">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{Math.round(pct)}% of expenses</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lavazam Outstanding */}
      {lavazamSummary.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden">
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Lavazam Report — {reportYear}</h2>
            <button onClick={exportLavazamCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              <Download className="w-3.5 h-3.5" />CSV
            </button>
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase px-5 py-3">Member</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase px-5 py-3">Due</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase px-5 py-3">Paid</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase px-5 py-3">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lavazamSummary.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">
                      {m.name}
                      {!m.is_active && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-right text-gray-600">{formatCurrency(m.totalDue)}</td>
                    <td className="px-5 py-3 text-sm text-right text-emerald-600 font-medium">{formatCurrency(m.totalPaid)}</td>
                    <td className={`px-5 py-3 text-sm text-right font-bold ${m.outstanding > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {formatCurrency(m.outstanding)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50/80 font-bold">
                  <td className="px-5 py-3 text-sm text-gray-900">Total</td>
                  <td className="px-5 py-3 text-sm text-right text-gray-600">{formatCurrency(totalLavazamDue)}</td>
                  <td className="px-5 py-3 text-sm text-right text-emerald-600">{formatCurrency(totalLavazamPaid)}</td>
                  <td className={`px-5 py-3 text-sm text-right ${totalLavazamDue - totalLavazamPaid > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {formatCurrency(totalLavazamDue - totalLavazamPaid)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-50">
            {lavazamSummary.filter(m => m.outstanding > 0).map(m => (
              <div key={m.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-400">Paid: {formatCurrency(m.totalPaid)} / {formatCurrency(m.totalDue)}</p>
                </div>
                <span className="text-sm font-bold text-red-500">{formatCurrency(m.outstanding)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
