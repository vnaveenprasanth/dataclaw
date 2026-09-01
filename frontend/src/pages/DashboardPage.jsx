import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/lib/api'
import { motion } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, DollarSign, FileText,
  ArrowRight, TrendingUp, ShieldAlert, Clock
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// KPI card with framer-motion count-up
function KpiCard({ label, value, prefix = '', suffix = '', icon: Icon, variant = 'default', loading }) {
  const colorMap = {
    default:     'text-foreground',
    danger:      'text-red-400',
    warning:     'text-amber-400',
    success:     'text-green-400',
    primary:     'text-primary',
  }
  const bgMap = {
    default:     'bg-muted/30',
    danger:      'bg-red-500/10',
    warning:     'bg-amber-500/10',
    success:     'bg-green-500/10',
    primary:     'bg-primary/10',
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border hover:border-muted-foreground/40 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <p className="kpi-label">{label}</p>
          <div className={cn('flex size-8 items-center justify-center rounded-md', bgMap[variant])}>
            <Icon className={cn('size-4', colorMap[variant])} />
          </div>
        </div>
        <motion.p
          className={cn('kpi-value', colorMap[variant])}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </motion.p>
      </CardContent>
    </Card>
  )
}

function SeverityBar({ counts }) {
  const total = (counts?.HIGH || 0) + (counts?.MEDIUM || 0) + (counts?.LOW || 0)
  if (!total) return null

  return (
    <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
      <div className="bg-red-500 transition-all" style={{ width: `${(counts.HIGH / total) * 100}%` }} />
      <div className="bg-amber-500 transition-all" style={{ width: `${(counts.MEDIUM / total) * 100}%` }} />
      <div className="bg-green-500 transition-all" style={{ width: `${(counts.LOW / total) * 100}%` }} />
    </div>
  )
}

const TYPE_LABELS = {
  AMOUNT_MISMATCH:         'Amount Mismatch',
  CURRENCY_MISMATCH:       'Currency Mismatch',
  DUPLICATE_PAYMENT:       'Duplicate Payment',
  PHANTOM_PAYMENT:         'Phantom Payment',
  MISSING_PAYMENT:         'Missing Payment',
  FAILED_PAYMENT:          'Failed Payment',
  CANCELLED_ORDER_CHARGED: 'Cancelled & Charged',
  PARTIAL_REFUND:          'Partial Refund',
  UNEXPECTED_REFUND:       'Unexpected Refund',
  DUPLICATE_ORDER:         'Duplicate Order',
  DATA_QUALITY:            'Data Quality',
}

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export default function DashboardPage() {
  const { api } = useApi()
  const navigate = useNavigate()

  // Get latest session
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await api.get('/sessions')
      return data
    },
  })

  const latestSession = sessions?.[0]

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', latestSession?.id],
    queryFn: async () => {
      const { data } = await api.get(`/sessions/${latestSession.id}/summary`)
      return data
    },
    enabled: !!latestSession,
  })

  const loading = sessionsLoading || summaryLoading

  if (!loading && !latestSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <FileText className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">No data yet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your orders and payments CSV files to begin reconciliation
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-2 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Upload Data <ArrowRight className="size-3.5" />
        </button>
      </div>
    )
  }

  // Sort type breakdown by severity (HIGH first)
  const typeBreakdown = summary?.type_breakdown
    ? Object.entries(summary.type_breakdown).sort(([, a], [, b]) => {
        const aSev = a.severities?.HIGH ? 0 : a.severities?.MEDIUM ? 1 : 2
        const bSev = b.severities?.HIGH ? 0 : b.severities?.MEDIUM ? 1 : 2
        return aSev - bSev || b.total_risk - a.total_risk
      })
    : []

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reconciliation Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '—' : `Session #${latestSession?.id} · ${latestSession?.orders_filename} + ${latestSession?.payments_filename}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-2 h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
        >
          New Upload
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard loading={loading} label="Orders Processed" value={summary?.total_orders} icon={FileText} />
        <KpiCard loading={loading} label="Payments Processed" value={summary?.total_payments} icon={CheckCircle2} variant="success" />
        <KpiCard
          loading={loading}
          label="Discrepancies Found"
          value={summary?.total_discrepancies}
          icon={AlertTriangle}
          variant={summary?.total_discrepancies > 0 ? 'danger' : 'success'}
        />
        <KpiCard
          loading={loading}
          label="Total at Risk"
          value={summary?.total_at_risk?.toFixed(2)}
          prefix="$"
          icon={DollarSign}
          variant={summary?.total_at_risk > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Severity breakdown + type breakdown */}
      <div className="grid grid-cols-3 gap-6">
        {/* Severity */}
        <Card className="bg-card border-border col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <>
                <SeverityBar counts={summary?.severity_breakdown} />
                {[
                  { key: 'HIGH',   label: 'High',   cls: 'dot-high',   badge: 'badge-high' },
                  { key: 'MEDIUM', label: 'Medium', cls: 'dot-medium', badge: 'badge-medium' },
                  { key: 'LOW',    label: 'Low',    cls: 'dot-low',    badge: 'badge-low' },
                ].map(({ key, label, cls, badge }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full', cls)} />
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badge)}>
                      {summary?.severity_breakdown?.[key] ?? 0}
                    </span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Type breakdown */}
        <Card className="bg-card border-border col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Discrepancy Types</CardTitle>
            {latestSession && (
              <button
                onClick={() => navigate(`/discrepancies/${latestSession.id}`)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View all <ArrowRight className="size-3" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : typeBreakdown.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-400 py-4">
                <CheckCircle2 className="size-4" />
                No discrepancies found — books are balanced!
              </div>
            ) : (
              <div className="space-y-1">
                {typeBreakdown.map(([type, data]) => {
                  const topSev = data.severities?.HIGH ? 'HIGH' : data.severities?.MEDIUM ? 'MEDIUM' : 'LOW'
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between py-2 hover:bg-accent/50 rounded-md px-2 cursor-pointer transition-colors"
                      onClick={() => navigate(`/discrepancies/${latestSession?.id}?type=${type}`)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          topSev === 'HIGH' ? 'dot-high' : topSev === 'MEDIUM' ? 'dot-medium' : 'dot-low'
                        )} />
                        <span className="text-sm text-foreground truncate">
                          {TYPE_LABELS[type] || type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground tabular">
                          ${data.total_risk.toFixed(2)}
                        </span>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          topSev === 'HIGH' ? 'badge-high' : topSev === 'MEDIUM' ? 'badge-medium' : 'badge-low'
                        )}>
                          {data.count}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
