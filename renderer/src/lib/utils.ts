import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const TRANSACTION_CATEGORIES = [
  'Payroll & Income',
  'Transfers',
  'Vendor Payments',
  'Utilities',
  'Rent & Lease',
  'Insurance',
  'Banking Fees',
  'Tax Payments',
  'Loan Payments',
  'Office Supplies',
  'Travel & Transport',
  'Meals & Entertainment',
  'Software & Subscriptions',
  'Marketing & Advertising',
  'Professional Services',
  'Equipment & Hardware',
  'Refunds & Credits',
  'Other',
]

export const REGION_COLORS: Record<string, string> = {
  page_header: '#f5a623',
  group_header: '#00e5a0',
  detail_rows: '#4a90d9',
}

export const REGION_LABELS: Record<string, string> = {
  page_header: 'Page Header',
  group_header: 'Group Header',
  detail_rows: 'Detail Rows',
}
