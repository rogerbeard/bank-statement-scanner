import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Activity, Layers, RefreshCw } from 'lucide-react'
import { getTransactions, getStatements, type Transaction, type Statement } from '../lib/api'
import { formatCurrency, cn } from '../lib/utils'

const CHART_COLORS = [
  '#4a90d9', '#00e5a0', '#f5a623', '#ff4d6d', '#a78bfa',
  '#34d399', '#fb923c', '#60a5fa', '#f472b6', '#a3e635',
]

const TOOLTIP_STYLE = {
  backgroundColor: '#112244',
  border: '1px solid #1e3a5f',
  borderRadius: '4px',
  color: '#e8f4ff',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px',
}

function KpiCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub?: string
  icon: any; trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="bp-panel p-4 corner-marks relative">
      <div className="flex items-start justify-between">
        <div>
          <div className="bp-label mb-2">{label}</div>
          <div className="text-2xl font-bold text-blueprint-white font-mono">{value}</div>
          {sub && <div className="text-xs font-mono text-blueprint-dim mt-1">{sub}</div>}
        </div>
        <div className="w-9 h-9 rounded border border-blueprint-border flex items-center justify-center bg-blueprint-bg">
          <Icon size={16} className="text-blueprint-accent" />
        </div>
      </div>
      {trend && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-mono',
          trend === 'up' ? 'text-status-success' : trend === 'down' ? 'text-status-error' : 'text-blueprint-dim'
        )}>
          {trend === 'up' ? <TrendingUp size={11} /> : trend === 'down' ? <TrendingDown size={11} /> : null}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [statements, setStatements] = useState<Statement[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, stmtRes] = await Promise.all([getTransactions(), getStatements()])
      setTransactions(txRes.data)
      setStatements(stmtRes.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Derived data
  const totalDebit = transactions.reduce((s, t) => s + (t.debit || 0), 0)
  const totalCredit = transactions.reduce((s, t) => s + (t.credit || 0), 0)
  const net = totalCredit - totalDebit
  const avgTx = transactions.length > 0
    ? (totalDebit + totalCredit) / transactions.length
    : 0

  // Category breakdown
  const categoryMap = new Map<string, number>()
  transactions.forEach(t => {
    if (t.debit && t.debit > 0) {
      const cat = t.category || 'Other'
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + t.debit)
    }
  })
  const categoryData = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }))

  // Balance over time
  const balanceData = transactions
    .filter(t => t.balance !== null && t.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => ({
      date: t.date?.slice(0, 10) || '',
      balance: t.balance,
    }))

  // Monthly income vs expenses
  const monthlyMap = new Map<string, { month: string; income: number; expenses: number }>()
  transactions.forEach(t => {
    if (!t.date) return
    const month = t.date.slice(0, 7)
    if (!monthlyMap.has(month)) monthlyMap.set(month, { month, income: 0, expenses: 0 })
    const entry = monthlyMap.get(month)!
    if (t.credit) entry.income += t.credit
    if (t.debit) entry.expenses += t.debit
  })
  const monthlyData = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-blueprint-dim">
          <Activity size={32} className="animate-pulse text-blueprint-accent" />
          <span className="text-sm font-mono">LOADING ANALYTICS...</span>
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-blueprint-dim">
        <Layers size={40} className="opacity-30" />
        <div className="text-sm font-mono">NO DATA AVAILABLE</div>
        <div className="text-xs font-mono opacity-60">Extract transactions first to view analytics</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="bp-label mb-1">MODULE 03</div>
          <h1 className="text-2xl font-bold text-blueprint-white tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-blueprint-dim mt-1 font-mono">
            {transactions.length} transactions · {statements.length} statement(s)
          </p>
        </div>
        <button onClick={load} className="bp-btn py-1.5 px-2.5 text-xs">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Credits"
          value={formatCurrency(totalCredit)}
          sub={`${transactions.filter(t => t.credit).length} credit txns`}
          icon={TrendingUp}
          trend="up"
        />
        <KpiCard
          label="Total Debits"
          value={formatCurrency(totalDebit)}
          sub={`${transactions.filter(t => t.debit).length} debit txns`}
          icon={TrendingDown}
          trend="down"
        />
        <KpiCard
          label="Net Flow"
          value={formatCurrency(net)}
          sub={net >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
          icon={DollarSign}
          trend={net >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          label="Avg Transaction"
          value={formatCurrency(avgTx)}
          sub={`${transactions.length} total transactions`}
          icon={Activity}
          trend="neutral"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spending by category */}
        <div className="bp-panel p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="bp-label">Spending by Category</div>
          </div>
          {categoryData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-blueprint-dim text-xs font-mono">NO DEBIT DATA</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [formatCurrency(v), 'Amount']}
                />
                <Legend
                  formatter={(v) => <span style={{ color: '#8ab0d0', fontSize: '11px', fontFamily: 'JetBrains Mono' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Balance over time */}
        <div className="bp-panel p-4">
          <div className="bp-label mb-4">Balance Over Time</div>
          {balanceData.length < 2 ? (
            <div className="h-48 flex items-center justify-center text-blueprint-dim text-xs font-mono">INSUFFICIENT DATA</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={balanceData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,144,217,0.1)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8ab0d0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={d => d?.slice(5) || ''}
                />
                <YAxis
                  tick={{ fill: '#8ab0d0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [formatCurrency(v), 'Balance']}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#4a90d9"
                  strokeWidth={2}
                  dot={{ fill: '#4a90d9', r: 3 }}
                  activeDot={{ r: 5, fill: '#7ab8f5' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      {monthlyData.length > 0 && (
        <div className="bp-panel p-4">
          <div className="bp-label mb-4">Monthly Income vs Expenses</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,144,217,0.1)" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8ab0d0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis
                tick={{ fill: '#8ab0d0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [formatCurrency(v)]}
              />
              <Legend
                formatter={(v) => <span style={{ color: '#8ab0d0', fontSize: '11px', fontFamily: 'JetBrains Mono' }}>{v.toUpperCase()}</span>}
              />
              <Bar dataKey="income" name="Credits" fill="#00e5a0" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expenses" name="Debits" fill="#ff4d6d" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category summary table */}
      {categoryData.length > 0 && (
        <div className="bp-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-blueprint-border">
            <div className="bp-label">Category Breakdown</div>
          </div>
          <table className="bp-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Total Debits</th>
                <th className="text-right">% of Spend</th>
                <th>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map(({ name, value }, i) => (
                <tr key={name}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span>{name}</span>
                    </div>
                  </td>
                  <td className="text-right text-status-error font-mono">{formatCurrency(value)}</td>
                  <td className="text-right font-mono text-blueprint-dim">
                    {totalDebit > 0 ? ((value / totalDebit) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="w-40">
                    <div className="h-1.5 bg-blueprint-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${totalDebit > 0 ? (value / totalDebit) * 100 : 0}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
