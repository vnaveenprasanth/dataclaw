import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/lib/api'
import { motion } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, DollarSign, FileText,
  ArrowRight, Activity, Scale, ShieldAlert, Sparkles, Loader2,
  TrendingDown, ListChecks, Zap
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

// KPI card — compact, icon inline with label
function KpiCard({ label, value, prefix = '', suffix = '', icon: Icon, variant = 'default', loading, subtext }) {
  const colorMap = {
    default:  'text-foreground',
    danger:   'text-destructive',
    warning:  'text-amber-500',
    success:  'text-green-500',
    primary:  'text-primary',
    purple:   'text-violet-400',
  }
  const iconBgMap = {
    default:  'bg-muted/60',
    danger:   'bg-destructive/15',
    warning:  'bg-amber-500/15',
    success:  'bg-green-500/15',
    primary:  'bg-primary/15',
    purple:   'bg-violet-500/15',
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <Skeleton className="h-3.5 w-24 mb-2" />
          <Skeleton className="h-7 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border hover:border-muted-foreground/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden group">
      <div className={cn("absolute -right-3 -top-3 size-16 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500", iconBgMap[variant])} />
      <CardContent className="p-4 relative z-10">
        {/* Label row with icon */}
        <div className="flex items-center gap-2 mb-3">
          <div className={cn('flex size-7 items-center justify-center rounded-md shrink-0', iconBgMap[variant])}>
            <Icon className={cn('size-3.5', colorMap[variant])} />
          </div>
          <p className="text-sm font-bold text-foreground leading-tight">{label}</p>
        </div>
        {/* Value */}
        <motion.p
          className={cn('text-2xl font-extrabold tracking-tight tabular-nums', colorMap[variant])}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {prefix}{typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}{suffix}
        </motion.p>
        {subtext && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{subtext}</p>
        )}
      </CardContent>
    </Card>
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

const SEVERITY_COLORS = { HIGH: 'destructive', MEDIUM: 'warning', LOW: 'secondary' }

function AiSummaryCard({ sessionId }) {
  const { api } = useApi()
  const [summary, setSummary] = useState(null)

  // Fetch cached summary on mount / session change
  useEffect(() => {
    setSummary(null)
    if (!sessionId) return
    api.get(`/llm/summarize/${sessionId}`).then(({ data }) => {
      if (data.summary) setSummary(data.summary)
    }).catch(() => {})
  }, [sessionId])

  const summaryMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/llm/summarize', { session_id: sessionId })
      return data
    },
    onSuccess: (data) => setSummary(data.summary),
  })

  const sev = summary?.overall_severity
  const sevColor = sev === 'HIGH' ? 'text-destructive' : sev === 'MEDIUM' ? 'text-amber-500' : 'text-green-500'
  const sevBg   = sev === 'HIGH' ? 'bg-destructive/10 border-destructive/30' : sev === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30'

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold">AI Executive Summary</CardTitle>
              {summary?.cached && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-border">Cached</Badge>
              )}
            </div>
            <CardDescription className="text-xs">LLM-generated overview of this reconciliation run</CardDescription>
          </div>
        </div>
        {!summary && (
          <Button
            onClick={() => summaryMutation.mutate()}
            disabled={summaryMutation.isPending}
            size="sm"
            className="shrink-0"
          >
            {summaryMutation.isPending ? (
              <><Loader2 className="mr-2 size-3.5 animate-spin" />Analyzing…</>
            ) : (
              <><Sparkles className="mr-2 size-3.5" />Generate Summary</>
            )}
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {summaryMutation.isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {summaryMutation.isError && (
          <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="size-4 shrink-0" />
            Failed to generate summary. Please try again.
          </div>
        )}

        {!summary && !summaryMutation.isPending && !summaryMutation.isError && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Click "Generate Summary" to get an AI-powered analysis of all discrepancies in this run.
          </p>
        )}

        {summary && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Headline + Severity */}
            <div className={cn("flex items-start justify-between gap-4 p-4 rounded-lg border", sevBg)}>
              <p className="text-sm font-semibold text-foreground leading-relaxed">{summary.headline}</p>
              <Badge variant="outline" className={cn("shrink-0 font-bold border", sevColor)}>
                {sev} RISK
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Key Findings */}
              <div className="lg:col-span-2 p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="size-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">Key Findings</h4>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {summary.key_findings?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Top Priority */}
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="size-4 text-amber-500" />
                  <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Top Priority</h4>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{summary.top_priority}</p>
              </div>
            </div>

            {/* Recommended Actions */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="size-4 text-primary" />
                <h4 className="text-sm font-semibold text-primary">Recommended Actions</h4>
              </div>
              <ol className="flex flex-col gap-1.5">
                {summary.recommended_actions?.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="shrink-0 flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

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
        <div className="flex size-16 items-center justify-center rounded-full bg-muted shadow-inner">
          <FileText className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">No data yet</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Upload your orders and payments CSV files to begin reconciliation and uncover discrepancies.
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-2 h-10 mt-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
        >
          Upload Data <ArrowRight className="size-4" />
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

  // --- Chart Data ---

  const pieData = {
    labels: ['High Risk', 'Medium Risk', 'Low Risk'],
    datasets: [{
      data: [
        summary?.severity_breakdown?.HIGH || 0,
        summary?.severity_breakdown?.MEDIUM || 0,
        summary?.severity_breakdown?.LOW || 0,
      ],
      backgroundColor: [
        'rgba(239, 68, 68, 0.9)',
        'rgba(245, 158, 11, 0.9)',
        'rgba(34, 197, 94, 0.9)',
      ],
      borderColor: 'rgba(0,0,0,0.1)',
      borderWidth: 1,
      hoverOffset: 4,
    }]
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: 'rgba(255, 255, 255, 0.7)', padding: 20, font: { family: 'inherit', size: 12 } }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { family: 'inherit' },
        bodyFont: { family: 'inherit' },
        padding: 10,
        cornerRadius: 8,
      }
    }
  }

  const barData = {
    labels: typeBreakdown.map(([type]) => TYPE_LABELS[type] || type),
    datasets: [{
      label: 'Total at Risk ($)',
      data: typeBreakdown.map(([, data]) => data.total_risk),
      backgroundColor: typeBreakdown.map(([, data]) => {
        if (data.severities?.HIGH) return 'rgba(239, 68, 68, 0.8)'
        if (data.severities?.MEDIUM) return 'rgba(245, 158, 11, 0.8)'
        return 'rgba(34, 197, 94, 0.8)'
      }),
      borderRadius: 4,
    }]
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { family: 'inherit' },
        bodyFont: { family: 'inherit' },
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: (c) => ` $${c.parsed.y.toFixed(2)}` }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'inherit' } }
      },
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { family: 'inherit', size: 11 }, maxRotation: 45, minRotation: 45 }
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">Reconciliation Overview</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {loading ? 'Loading session details...' : (
              <>
                <Activity className="size-3.5" />
                Showing Latest Run (Session #{latestSession?.id}) · Processed {new Date(latestSession?.uploaded_at).toLocaleDateString()}
              </>
            )}
          </p>
        </div>
      </div>

      {/* KPI Cards — 6 columns on XL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard loading={loading} label="Orders Processed" value={summary?.total_orders} icon={FileText} />
        <KpiCard loading={loading} label="Payments Processed" value={summary?.total_payments} icon={CheckCircle2} variant="success" />
        <KpiCard
          loading={loading}
          label="Total Reconciled"
          value={summary?.total_reconciled_value?.toFixed(2)}
          prefix="$"
          icon={Scale}
          variant="primary"
          subtext="Sum of all order values"
        />
        <KpiCard
          loading={loading}
          label="Discrepancies Found"
          value={summary?.total_discrepancies}
          icon={AlertTriangle}
          variant={summary?.total_discrepancies > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          loading={loading}
          label="Total in Dispute"
          value={summary?.total_in_dispute?.toFixed(2)}
          prefix="$"
          icon={ShieldAlert}
          variant={summary?.total_in_dispute > 0 ? 'warning' : 'success'}
          subtext="Sum of all mismatched amounts"
        />
        <KpiCard
          loading={loading}
          label="Total at Risk"
          value={summary?.total_at_risk?.toFixed(2)}
          prefix="$"
          icon={DollarSign}
          variant={summary?.total_at_risk > 0 ? 'danger' : 'success'}
          subtext="Highest-severity exposure"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Pie Chart */}
        <Card className="bg-card border-border lg:col-span-1 flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center min-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="size-48 rounded-full" />
              </div>
            ) : summary?.total_discrepancies === 0 ? (
              <div className="text-center text-muted-foreground text-sm flex flex-col items-center">
                <CheckCircle2 className="size-8 text-green-400 mb-2 opacity-50" />
                No discrepancies found
              </div>
            ) : (
              <div className="relative h-64 w-full">
                <Pie data={pieData} options={pieOptions} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discrepancy Types Bar Chart */}
        <Card className="bg-card border-border lg:col-span-2 flex flex-col shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">Risk by Discrepancy Type</CardTitle>
            {latestSession && summary?.total_discrepancies > 0 && (
              <button
                onClick={() => navigate(`/runs`)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-full"
              >
                View Details <ArrowRight className="size-3" />
              </button>
            )}
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col gap-4 h-full justify-end">
                <Skeleton className="h-4/5 w-full rounded-t-md" />
              </div>
            ) : typeBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-green-400 font-medium">
                <CheckCircle2 className="size-5 mr-2" />
                Books are perfectly balanced!
              </div>
            ) : (
              <div className="relative h-[280px] w-full mt-4">
                <Bar data={barData} options={barOptions} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Executive Summary */}
      {latestSession && !loading && (
        <AiSummaryCard sessionId={latestSession.id} />
      )}
    </div>
  )
}
