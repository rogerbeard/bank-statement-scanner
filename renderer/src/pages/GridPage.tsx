import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Download, FileSpreadsheet, FileText, RefreshCw, Plus,
  Trash2, Filter, Layers, Loader2, Edit3, Check, X,
  ChevronUp, ChevronDown, Search
} from 'lucide-react'
import {
  getStatements, getTransactions, updateTransaction, deleteTransaction,
  addTransaction, exportExcel, exportCsv,
  type Statement, type Transaction
} from '../lib/api'
import { cn, formatCurrency, formatDate, downloadBlob, TRANSACTION_CATEGORIES } from '../lib/utils'

type SortField = 'date' | 'description' | 'debit' | 'credit' | 'balance' | 'category'
type SortDir = 'asc' | 'desc'

function EditableCell({
  value, type = 'text', options,
  onSave
}: {
  value: string | number | null
  type?: 'text' | 'number' | 'date' | 'select'
  options?: string[]
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(String(value ?? '')); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {type === 'select' ? (
          <select
            ref={inputRef as any}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            className="bg-blueprint-bg border border-blueprint-accent text-blueprint-white text-xs font-mono rounded px-1.5 py-0.5 focus:outline-none w-full"
          >
            {options?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            ref={inputRef as any}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            className="bg-blueprint-bg border border-blueprint-accent text-blueprint-white text-xs font-mono rounded px-1.5 py-0.5 focus:outline-none w-full min-w-0"
          />
        )}
        <button onClick={commit} className="text-status-success hover:opacity-80 flex-shrink-0"><Check size={11} /></button>
        <button onClick={cancel} className="text-status-error hover:opacity-80 flex-shrink-0"><X size={11} /></button>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:text-blueprint-bright group flex items-center gap-1 min-w-0"
      title="Click to edit"
    >
      <span className="truncate">{String(value ?? '—')}</span>
      <Edit3 size={9} className="opacity-0 group-hover:opacity-40 flex-shrink-0" />
    </div>
  )
}

export default function GridPage() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'combined' | 'separate'>('combined')
  const [activeStatementId, setActiveStatementId] = useState<string | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [exporting, setExporting] = useState<'excel' | 'csv' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stmtRes, txRes] = await Promise.all([getStatements(), getTransactions()])
      setStatements(stmtRes.data)
      setTransactions(txRes.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const handleUpdate = async (id: string, field: keyof Transaction, raw: string) => {
    const numFields = ['debit', 'credit', 'balance']
    const value = numFields.includes(field) ? (raw === '' ? null : parseFloat(raw)) : raw
    try {
      await updateTransaction(id, { [field]: value })
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
    } catch {
      toast.error('Failed to update transaction')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id)
      setTransactions(prev => prev.filter(t => t.id !== id))
      toast.success('Transaction deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleAddRow = async () => {
    const stmtId = activeStatementId === 'all' ? statements[0]?.id : activeStatementId
    if (!stmtId) { toast.error('No statement selected'); return }
    try {
      const res = await addTransaction({
        statementId: stmtId,
        pageIndex: 0,
        date: new Date().toISOString().split('T')[0],
        description: 'New Transaction',
        debit: null,
        credit: null,
        balance: null,
        category: 'Other',
        notes: '',
        rowIndex: transactions.length,
      })
      setTransactions(prev => [...prev, res.data])
    } catch {
      toast.error('Failed to add row')
    }
  }

  const handleExport = async (format: 'excel' | 'csv') => {
    setExporting(format)
    try {
      const stmtId = activeStatementId === 'all' ? undefined : activeStatementId
      const res = format === 'excel' ? await exportExcel(stmtId) : await exportCsv(stmtId)
      const ext = format === 'excel' ? 'xlsx' : 'csv'
      downloadBlob(res.data, `bank_statements_${Date.now()}.${ext}`)
      toast.success(`Exported as ${ext.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(null)
    }
  }

  // Filter & sort
  const filtered = transactions
    .filter(t => {
      if (activeStatementId !== 'all' && t.statementId !== activeStatementId) return false
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.description?.toLowerCase().includes(q) ||
          t.date?.includes(q) ||
          t.category?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      let av: any = a[sortField], bv: any = b[sortField]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av === null) return 1; if (bv === null) return -1
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  // Summaries
  const totalDebit = filtered.reduce((s, t) => s + (t.debit || 0), 0)
  const totalCredit = filtered.reduce((s, t) => s + (t.credit || 0), 0)
  const lastBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : null

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp size={10} className="opacity-20" />
    return sortDir === 'asc' ? <ChevronUp size={10} className="text-blueprint-accent" /> : <ChevronDown size={10} className="text-blueprint-accent" />
  }

  const categories = ['all', ...Array.from(new Set(transactions.map(t => t.category).filter(Boolean)))]

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-blueprint-border bg-blueprint-surface flex flex-wrap items-center gap-3">
        <div>
          <div className="bp-label">Data Grid</div>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 bg-blueprint-bg rounded border border-blueprint-border p-0.5">
          {(['combined', 'separate'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setActiveStatementId('all') }}
              className={cn(
                'px-3 py-1 rounded text-xs font-mono transition-all',
                viewMode === mode
                  ? 'bg-blueprint-line text-white'
                  : 'text-blueprint-dim hover:text-blueprint-white'
              )}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Statement tabs (separate mode) */}
        {viewMode === 'separate' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveStatementId('all')}
              className={cn('bp-badge cursor-pointer', activeStatementId === 'all' ? 'bg-blueprint-line/30 text-blueprint-bright' : 'bg-blueprint-bg text-blueprint-dim hover:text-blueprint-white')}
            >
              ALL
            </button>
            {statements.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveStatementId(s.id)}
                className={cn('bp-badge cursor-pointer max-w-[120px] truncate', activeStatementId === s.id ? 'bg-blueprint-line/30 text-blueprint-bright' : 'bg-blueprint-bg text-blueprint-dim hover:text-blueprint-white')}
                title={s.originalName}
              >
                {s.originalName.replace('.pdf', '')}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blueprint-dim" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="bp-input pl-7 py-1.5 text-xs w-44"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bp-input py-1.5 text-xs w-44"
        >
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>

        {/* Actions */}
        <button onClick={handleAddRow} className="bp-btn py-1.5 px-2.5 text-xs">
          <Plus size={12} /> Add Row
        </button>
        <button onClick={load} className="bp-btn py-1.5 px-2 text-xs" title="Refresh">
          <RefreshCw size={12} />
        </button>
        <button
          onClick={() => handleExport('excel')}
          disabled={exporting === 'excel'}
          className="bp-btn-primary py-1.5 px-2.5 text-xs"
        >
          {exporting === 'excel' ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
          Excel
        </button>
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting === 'csv'}
          className="bp-btn py-1.5 px-2.5 text-xs"
        >
          {exporting === 'csv' ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          CSV
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-blueprint-border bg-blueprint-bg/50 flex items-center gap-6 text-xs font-mono">
        <span className="text-blueprint-dim">
          <span className="text-blueprint-white font-semibold">{filtered.length}</span> transactions
        </span>
        <span className="text-blueprint-dim">
          DEBITS: <span className="text-status-error font-semibold">{formatCurrency(totalDebit)}</span>
        </span>
        <span className="text-blueprint-dim">
          CREDITS: <span className="text-status-success font-semibold">{formatCurrency(totalCredit)}</span>
        </span>
        <span className="text-blueprint-dim">
          NET: <span className={cn('font-semibold', totalCredit - totalDebit >= 0 ? 'text-status-success' : 'text-status-error')}>
            {formatCurrency(totalCredit - totalDebit)}
          </span>
        </span>
        {lastBalance !== null && (
          <span className="text-blueprint-dim">
            LAST BALANCE: <span className="text-blueprint-white font-semibold">{formatCurrency(lastBalance)}</span>
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={28} className="animate-spin text-blueprint-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-blueprint-dim">
            <Layers size={40} className="opacity-30" />
            <div className="text-sm font-mono">NO TRANSACTIONS FOUND</div>
            <div className="text-xs font-mono opacity-60">Upload and extract statements to populate the grid</div>
          </div>
        ) : (
          <table className="bp-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-8 text-center">#</th>
                {[
                  { field: 'date' as SortField, label: 'Date', w: 'w-28' },
                  { field: 'description' as SortField, label: 'Description', w: 'min-w-[200px]' },
                  { field: 'debit' as SortField, label: 'Debit (−)', w: 'w-28 text-right' },
                  { field: 'credit' as SortField, label: 'Credit (+)', w: 'w-28 text-right' },
                  { field: 'balance' as SortField, label: 'Balance', w: 'w-28 text-right' },
                  { field: 'category' as SortField, label: 'Category', w: 'w-40' },
                ].map(({ field, label, w }) => (
                  <th key={field} className={w}>
                    <button
                      onClick={() => handleSort(field)}
                      className="flex items-center gap-1 hover:text-blueprint-white transition-colors"
                    >
                      {label} <SortIcon field={field} />
                    </button>
                  </th>
                ))}
                <th className="w-16 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, idx) => (
                <tr key={tx.id} className="group">
                  <td className="text-center text-blueprint-dim/60 text-[10px]">{idx + 1}</td>
                  <td className="text-blueprint-dim text-xs">
                    <EditableCell
                      value={tx.date}
                      type="date"
                      onSave={v => handleUpdate(tx.id, 'date', v)}
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={tx.description}
                      onSave={v => handleUpdate(tx.id, 'description', v)}
                    />
                  </td>
                  <td className="text-right">
                    <EditableCell
                      value={tx.debit !== null ? tx.debit?.toFixed(2) : null}
                      type="number"
                      onSave={v => handleUpdate(tx.id, 'debit', v)}
                    />
                    {tx.debit !== null && (
                      <span className="text-status-error text-xs font-mono">{formatCurrency(tx.debit)}</span>
                    )}
                  </td>
                  <td className="text-right">
                    <EditableCell
                      value={tx.credit !== null ? tx.credit?.toFixed(2) : null}
                      type="number"
                      onSave={v => handleUpdate(tx.id, 'credit', v)}
                    />
                    {tx.credit !== null && (
                      <span className="text-status-success text-xs font-mono">{formatCurrency(tx.credit)}</span>
                    )}
                  </td>
                  <td className="text-right">
                    <EditableCell
                      value={tx.balance !== null ? tx.balance?.toFixed(2) : null}
                      type="number"
                      onSave={v => handleUpdate(tx.id, 'balance', v)}
                    />
                    {tx.balance !== null && (
                      <span className="text-blueprint-white text-xs font-mono">{formatCurrency(tx.balance)}</span>
                    )}
                  </td>
                  <td>
                    <EditableCell
                      value={tx.category || 'Other'}
                      type="select"
                      options={TRANSACTION_CATEGORIES}
                      onSave={v => handleUpdate(tx.id, 'category', v)}
                    />
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="opacity-0 group-hover:opacity-100 text-blueprint-dim hover:text-status-error transition-all p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
