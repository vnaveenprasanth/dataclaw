import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/lib/api'
import { motion } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, DollarSign, FileText,
  ArrowRight, Activity
} from 'lucide-react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

// KPI card with framer-motion and polished hover effects
function KpiCard({ label, value, prefix = '', suffix = '', icon: Icon, variant = 'default', loading }) {
  const colorMap = {
    default:     'text-foreground',
    danger:      'text-destructive',
    warning:     'text-amber-500',
    success:     'text-green-500',
    primary:     'text-primary',
  }
  const bgMap = {
    default:     'bg-muted/30 shadow-none',
    danger:      'bg-destructive/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
    warning:     'bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    success:     'bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.15)]',
    primary:     'bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
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
    <Card className="bg-card border-border hover:border-muted-foreground/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden group">
      {/* Subtle background glow effect on hover */}
      <div className={cn("absolute -right-4 -top-4 size-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500", bgMap[variant].split(' ')[0])} />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <p className="kpi-label font-semibold">{label}</p>
          <div className={cn('flex size-10 items-center justify-center rounded-lg transition-colors', bgMap[variant].split(' ')[0])}>
            <Icon className={cn('size-5', colorMap[variant])} />
          </div>
        </div>
        <motion.p
          className={cn('text-4xl font-extrabold tracking-tight tabular-nums', colorMap[variant])}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </motion.p>
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

  // --- Chart Data Preparation ---

  // Pie Chart (Severity)
  const pieData = {
    labels: ['High Risk', 'Medium Risk', 'Low Risk'],
    datasets: [
      {
        data: [
          summary?.severity_breakdown?.HIGH || 0,
          summary?.severity_breakdown?.MEDIUM || 0,
          summary?.severity_breakdown?.LOW || 0,
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.9)', // red-500
          'rgba(245, 158, 11, 0.9)', // amber-500
          'rgba(34, 197, 94, 0.9)',  // green-500
        ],
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        hoverOffset: 4,
      }
    ]
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

  // Bar Chart (Discrepancy Types)
  const barLabels = typeBreakdown.map(([type]) => TYPE_LABELS[type] || type)
  const barDataVals = typeBreakdown.map(([, data]) => data.total_risk)
  const barColors = typeBreakdown.map(([, data]) => {
    if (data.severities?.HIGH) return 'rgba(239, 68, 68, 0.8)'
    if (data.severities?.MEDIUM) return 'rgba(245, 158, 11, 0.8)'
    return 'rgba(34, 197, 94, 0.8)'
  })

  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Total at Risk ($)',
        data: barDataVals,
        backgroundColor: barColors,
        borderRadius: 4,
      }
    ]
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
        callbacks: {
          label: (context) => ` $${context.parsed.y.toFixed(2)}`
        }
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard loading={loading} label="Orders Processed" value={summary?.total_orders} icon={FileText} />
        <KpiCard loading={loading} label="Payments Processed" value={summary?.total_payments} icon={CheckCircle2} variant="success" />
        <KpiCard
          loading={loading}
          label="Discrepancies Found"
          value={summary?.total_discrepancies}
          icon={AlertTriangle}
          variant={summary?.total_discrepancies > 0 ? 'warning' : 'success'}
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
    </div>
  )
}
