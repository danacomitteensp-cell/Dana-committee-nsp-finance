/**
 * Shared formatting and utility functions for the financial module.
 */

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

export const formatCurrencyPrecise = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const formatMonth = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

export const formatMonthShort = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'short',
  })
}

export const getMonthName = (monthNum) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[monthNum - 1] || '—'
}

export const TRANSACTION_TYPE_LABELS = {
  lavazam: 'Lavazam',
  fund_collection: 'Collection',
  expense: 'Expense',
  refund: 'Refund',
  adjustment: 'Adjustment',
}

export const TRANSACTION_TYPE_COLORS = {
  lavazam: 'bg-blue-50 text-blue-700',
  fund_collection: 'bg-purple-50 text-purple-700',
  expense: 'bg-red-50 text-red-600',
  refund: 'bg-amber-50 text-amber-700',
  adjustment: 'bg-gray-100 text-gray-600',
}

export const STATUS_COLORS = {
  completed: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  void: 'bg-gray-100 text-gray-400 line-through',
}

export const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
}

export const ACCOUNT_TYPE_LABELS = {
  cash: 'Cash',
  bank: 'Bank',
  upi: 'UPI',
  other: 'Other',
}

export const FUND_TYPE_LABELS = {
  event: 'Event',
  trip: 'Trip',
  emergency: 'Emergency',
  special: 'Special',
  other: 'Other',
}

/**
 * Calculate due status from amount_due and amount_paid
 */
export function getDueStatus(amountDue, amountPaid) {
  if (amountPaid >= amountDue) return 'paid'
  if (amountPaid > 0) return 'partial'
  return 'unpaid'
}

export const DUE_STATUS_STYLES = {
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Paid' },
  partial: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partial' },
  unpaid: { bg: 'bg-red-50', text: 'text-red-500', label: 'Unpaid' },
}

/**
 * Generate CSV from array of objects
 */
export function generateCSV(data, columns) {
  if (!data || data.length === 0) return ''
  const headers = columns.map(c => c.label).join(',')
  const rows = data.map(row =>
    columns.map(c => {
      let val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor]
      if (val === null || val === undefined) val = ''
      val = String(val).replace(/"/g, '""')
      return `"${val}"`
    }).join(',')
  )
  return [headers, ...rows].join('\n')
}

export function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
