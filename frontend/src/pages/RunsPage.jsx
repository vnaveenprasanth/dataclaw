import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  List,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertTriangle,
  Activity,
  TrendingDown,
  ListChecks,
  Zap,
  Package,
  CreditCard,
  ArrowRightLeft,
  Clock,
  Mail,
  Hash,
  Banknote,
  BadgePercent,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const TYPE_LABELS = {
  AMOUNT_MISMATCH: 'Amount Mismatch',
  CURRENCY_MISMATCH: 'Currency Mismatch',
  DUPLICATE_PAYMENT: 'Duplicate Payment',
  PHANTOM_PAYMENT: 'Phantom Payment',
  MISSING_PAYMENT: 'Missing Payment',
  FAILED_PAYMENT: 'Failed Payment',
  CANCELLED_ORDER_CHARGED: 'Cancelled & Charged',
  PARTIAL_REFUND: 'Partial Refund',
  UNEXPECTED_REFUND: 'Unexpected Refund',
  DUPLICATE_ORDER: 'Duplicate Order',
  DATA_QUALITY: 'Data Quality',
}

function SeverityIndicator({ severity }) {
  if (severity === 'HIGH') return <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20"><div className="size-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" /><span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">High</span></div>
  if (severity === 'MEDIUM') return <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20"><div className="size-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" /><span className="text-[11px] font-bold text-yellow-500 uppercase tracking-wider">Medium</span></div>
  return <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20"><div className="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" /><span className="text-[11px] font-bold text-green-500 uppercase tracking-wider">Low</span></div>
}

function DetailRow({ icon: Icon, label, value, mono = false, highlight = false }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 shrink-0">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <span className={cn(
        'text-sm text-right break-all max-w-[60%]',
        mono && 'font-mono text-xs',
        highlight ? 'font-bold text-foreground' : 'font-medium text-foreground'
      )}>
        {value}
      </span>
    </div>
  )
}

function RunAiSummaryModal({ sessionId, isOpen, onClose }) {
  const { api } = useApi()
  const [summary, setSummary] = useState(null)

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

  if (!sessionId) return null

  const sev = summary?.overall_severity
  const sevColor = sev === 'HIGH' ? 'text-red-500' : sev === 'MEDIUM' ? 'text-yellow-500' : 'text-green-500'
  const sevBg   = sev === 'HIGH' ? 'bg-red-500/10 border-red-500/30' : sev === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl relative"
          >
            <button 
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex items-center justify-center size-8 rounded-full bg-muted/50 hover:bg-muted text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
            <Card className="border-border shadow-sm m-0 rounded-none sm:rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border py-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold">AI Summary for this Run</CardTitle>
                    </div>
                    <CardDescription className="text-xs">On-demand analysis of all discrepancies</CardDescription>
                  </div>
                </div>
                {!summary && (
                  <Button
                    onClick={() => summaryMutation.mutate()}
                    disabled={summaryMutation.isPending}
                    size="sm"
                    className="shrink-0 mr-8"
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
                  <div className="flex flex-col gap-2.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3.5 w-5/6" />
                  </div>
                )}

                {summaryMutation.isError && (
                  <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="size-4 shrink-0" />
                    Failed to generate summary. Please try again.
                  </div>
                )}

                {summary && (
                  <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                    <div className={cn("flex items-start justify-between gap-4 p-3 rounded-lg border", sevBg)}>
                      <p className="text-sm font-semibold text-foreground leading-relaxed">{summary.headline}</p>
                      <Badge variant="outline" className={cn("shrink-0 font-bold border text-xs", sevColor)}>
                        {sev}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ListChecks className="size-3.5 text-primary" />
                          <span className="text-xs font-semibold text-foreground">Key Findings</span>
                        </div>
                        <ul className="flex flex-col gap-1">
                          {summary.key_findings?.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingDown className="size-3.5 text-primary" />
                          <span className="text-xs font-semibold text-primary">Recommended Actions</span>
                        </div>
                        <ol className="flex flex-col gap-1">
                          {summary.recommended_actions?.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="shrink-0 flex size-4 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold mt-0.5">
                                {i + 1}
                              </span>
                              {a}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// Discrepancy Detail Sheet — wide, premium design
function DiscrepancySheet({ row, onClose, explainMutation }) {
  if (!row) return null

  const sev = row.severity
  const sevBanner = sev === 'HIGH'
    ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-sm'
    : sev === 'MEDIUM'
    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500 shadow-sm'
    : 'bg-green-500/20 border-green-500/50 text-green-500 shadow-sm'
  const sevLabel = sev === 'HIGH' ? 'High Severity' : sev === 'MEDIUM' ? 'Medium Severity' : 'Low Severity'

  const orderDetail = row.order_detail || {}
  const paymentDetail = row.payment_detail || {}
  const expl = row.explanation

  const urgencyColor = expl?.urgency === 'HIGH' ? 'text-destructive bg-destructive/10 border-destructive/30'
    : expl?.urgency === 'MEDIUM' ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
    : 'text-green-500 bg-green-500/10 border-green-500/30'

  const confColor = expl?.confidence === 'HIGH' ? 'text-green-500 bg-green-500/10 border-green-500/30'
    : expl?.confidence === 'MEDIUM' ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
    : 'text-muted-foreground bg-muted/30 border-border'

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-[#0b1120]">
      {/* Hero Banner */}
      <div className={cn("px-6 py-5 border-b-2 flex items-center justify-between gap-4", sevBanner)}>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              <SheetTitle className="text-xl font-bold text-foreground">
                {TYPE_LABELS[row.discrepancy_type] || row.discrepancy_type}
              </SheetTitle>
              <Badge variant="outline" className={cn("font-bold border text-xs px-2.5 py-0.5 ml-1", sevBanner)}>
                {sevLabel}
              </Badge>
            </div>
          </div>
          <SheetDescription className="text-sm text-muted-foreground mt-0">
            {row.order_id && <span className="font-mono mr-3">Order: {row.order_id}</span>}
            {row.transaction_ref && <span className="font-mono">Txn: {row.transaction_ref}</span>}
          </SheetDescription>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {/* Amount Delta Callout */}
        {(row.order_amount !== null || row.payment_amount !== null) && row.discrepancy_type !== 'MISSING_PAYMENT' && row.discrepancy_type !== 'PHANTOM_PAYMENT' && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/20 border-2 border-border/80 shadow-sm">
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-1">Order Amount</p>
              <p className="text-xl font-bold text-foreground tabular-nums">${(row.order_amount || 0).toFixed(2)}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ArrowRightLeft className="size-4 text-muted-foreground" />
              <span className={cn(
                "text-xs font-bold tabular-nums",
                row.difference !== 0 ? 'text-destructive' : 'text-green-500'
              )}>
                Δ ${Math.abs(row.difference || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-1">Payment Amount</p>
              <p className="text-xl font-bold text-foreground tabular-nums">${(row.payment_amount || 0).toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Detail Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Order Details */}
          <div className="rounded-lg border-2 border-border/80 bg-muted/5 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-border/80 bg-muted/20 rounded-t-sm">
              <Package className="size-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Order Record</span>
            </div>
            <div className="px-4 py-2">
              <DetailRow icon={Hash} label="Order ID" value={row.order_id} mono highlight />
              <DetailRow icon={Clock} label="Order Date" value={orderDetail.order_date ? new Date(orderDetail.order_date).toLocaleString() : null} />
              <DetailRow icon={Mail} label="Customer Email" value={orderDetail.customer_email} />
              <DetailRow icon={Banknote} label="Gross Amount" value={orderDetail.gross_amount != null ? `$${Number(orderDetail.gross_amount).toFixed(2)}` : null} />
              <DetailRow icon={BadgePercent} label="Discount" value={orderDetail.discount != null ? `$${Number(orderDetail.discount).toFixed(2)}` : null} />
              <DetailRow icon={Banknote} label="Net Amount" value={orderDetail.net_amount != null ? `$${Number(orderDetail.net_amount).toFixed(2)}` : row.order_amount != null ? `$${row.order_amount.toFixed(2)}` : null} highlight />
              <DetailRow icon={Activity} label="Currency" value={orderDetail.currency || row.currency?.split('/')[0]} />
              <DetailRow icon={Activity} label="Order Status" value={orderDetail.status || row.details?.order_status} />
            </div>
          </div>

          {/* Payment Details */}
          <div className="rounded-lg border-2 border-border/80 bg-muted/5 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-border/80 bg-muted/20 rounded-t-sm">
              <CreditCard className="size-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Payment Record</span>
            </div>
            <div className="px-4 py-2">
              <DetailRow icon={Hash} label="Transaction Ref" value={row.transaction_ref} mono highlight />
              <DetailRow icon={Clock} label="Processed At" value={paymentDetail.processed_at ? new Date(paymentDetail.processed_at).toLocaleString() : null} />
              <DetailRow icon={Hash} label="Order Reference" value={paymentDetail.order_reference} mono />
              <DetailRow icon={Banknote} label="Amount" value={paymentDetail.amount != null ? `$${Number(paymentDetail.amount).toFixed(2)}` : row.payment_amount != null ? `$${row.payment_amount.toFixed(2)}` : null} highlight />
              <DetailRow icon={BadgePercent} label="Fee" value={paymentDetail.fee != null ? `$${Number(paymentDetail.fee).toFixed(2)}` : null} />
              <DetailRow icon={Banknote} label="Net Settled" value={paymentDetail.net_settled != null ? `$${Number(paymentDetail.net_settled).toFixed(2)}` : null} />
              <DetailRow icon={Activity} label="Currency" value={paymentDetail.currency || row.currency?.split('/')[1]} />
              <DetailRow icon={Activity} label="Payment Type" value={paymentDetail.payment_type || row.details?.payment_type} />
              <DetailRow icon={Activity} label="Payment Status" value={paymentDetail.status || row.details?.payment_status} />
            </div>
          </div>
        </div>

        {/* AI Root Cause Section */}
        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">AI Root Cause Analysis</h3>
                <p className="text-xs text-muted-foreground">Powered by Gemini</p>
              </div>
            </div>
            {!expl && (
              <Button
                onClick={() => explainMutation.mutate(row.id)}
                disabled={explainMutation.isPending}
                size="sm"
              >
                {explainMutation.isPending ? (
                  <><Loader2 className="mr-2 size-3.5 animate-spin" />Analyzing…</>
                ) : (
                  <><Sparkles className="mr-2 size-3.5" />Generate Analysis</>
                )}
              </Button>
            )}
          </div>

          {explainMutation.isError && (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="size-4 shrink-0" />
              Failed to generate explanation. Please try again.
            </div>
          )}

          {explainMutation.isPending && (
            <div className="flex flex-col gap-3 p-4 rounded-lg bg-muted/20 border border-border">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          )}

          {!expl && !explainMutation.isPending && !explainMutation.isError && (
            <p className="text-sm text-muted-foreground text-center py-3">
              Click "Generate Analysis" for a detailed AI explanation of this discrepancy.
            </p>
          )}

          {expl && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Badges Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">AI Assessment:</span>
                <Badge variant="outline" className={cn("text-xs font-semibold border", urgencyColor)}>
                  {expl.urgency} Urgency
                </Badge>
                <Badge variant="outline" className={cn("text-xs font-semibold border", confColor)}>
                  {expl.confidence} Confidence
                </Badge>
                {expl.is_partial && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                    Partial Result
                  </Badge>
                )}
              </div>

              {/* Likely Cause */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="size-4 text-primary" />
                  <h4 className="text-sm font-semibold text-primary">Likely Cause</h4>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{expl.likely_cause}</p>
              </div>

              {/* Business Impact */}
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="size-4 text-amber-500" />
                  <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Business Impact</h4>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{expl.business_impact}</p>
              </div>

              {/* Action Items */}
              {expl.action_items?.length > 0 && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="size-4 text-foreground" />
                    <h4 className="text-sm font-semibold text-foreground">Recommended Actions</h4>
                  </div>
                  <ol className="flex flex-col gap-2">
                    {expl.action_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="shrink-0 flex size-5 items-center justify-center rounded-full bg-foreground/10 text-foreground text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RunsPage() {
  const { api } = useApi()
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [showAiModal, setShowAiModal] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [severityFilter, typeFilter])

  // Fetch Sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data } = await api.get('/sessions')
      return data
    },
  })

  // Auto-select latest session on load
  useEffect(() => {
    if (sessions?.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  // Fetch Discrepancies
  const { data: discData, isLoading: discLoading, isFetching: discFetching } = useQuery({
    queryKey: ['discrepancies', activeSessionId, page, perPage, debouncedSearch, severityFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page,
        per_page: perPage,
        ...(debouncedSearch && { q: debouncedSearch }),
        ...(severityFilter && { severity: severityFilter }),
        ...(typeFilter && { type: typeFilter }),
      })
      const { data } = await api.get(`/sessions/${activeSessionId}/discrepancies?${params.toString()}`)
      return data
    },
    enabled: !!activeSessionId,
    keepPreviousData: true,
  })

  // AI Explanation Mutation
  const explainMutation = useMutation({
    mutationFn: async (resultId) => {
      const { data } = await api.post(`/llm/explain/${resultId}`)
      return data
    },
    onSuccess: (data) => {
      setSelectedRow(prev => ({ ...prev, explanation: data.explanation }))
    }
  })

  const removeFilter = (key) => {
    if (key === 'search') setSearch('')
    if (key === 'severity') setSeverityFilter('')
    if (key === 'type') setTypeFilter('')
  }

  const hasActiveFilters = search || severityFilter || typeFilter

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ── Top Section: Runs List ─────────────────────────────────── */}
      <Card className="rounded-md border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-normal flex items-center gap-2">
            <Activity className="size-6 text-primary" />
            Reconciliation Runs
          </CardTitle>
          <CardDescription>View your past upload sessions and access their detailed discrepancy reports.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="rounded-md border-2 border-border/80 overflow-hidden shadow-md">
            <Table>
              <TableHeader className="bg-muted/50 uppercase text-xs font-bold tracking-wider">
                <TableRow>
                  <TableHead className="w-[100px]">Run ID</TableHead>
                  <TableHead className="w-[200px]">Date</TableHead>
                  <TableHead className="w-[200px]">Orders File</TableHead>
                  <TableHead className="w-[200px]">Payments File</TableHead>
                  <TableHead className="w-[120px]">Orders</TableHead>
                  <TableHead className="w-[120px]">Payments</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-14"><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : sessions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No runs found. Upload data to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions?.map((session) => {
                    const isActive = activeSessionId === session.id
                    return (
                      <TableRow
                        key={session.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50",
                          isActive && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                        onClick={() => {
                          setActiveSessionId(session.id)
                          setSelectedRow(null)
                        }}
                      >
                        <TableCell className="font-semibold text-primary">#{session.id}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(session.uploaded_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="truncate max-w-[200px]" title={session.orders_filename}>
                          {session.orders_filename}
                        </TableCell>
                        <TableCell className="truncate max-w-[200px]" title={session.payments_filename}>
                          {session.payments_filename}
                        </TableCell>
                        <TableCell className="tabular-nums">{session.orders_count}</TableCell>
                        <TableCell className="tabular-nums">{session.payments_count}</TableCell>
                        <TableCell>
                          <Badge variant={session.status === 'COMPLETED' ? 'default' : session.status === 'FAILED' ? 'destructive' : 'secondary'}>
                            {session.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Bottom Section: Detailed Discrepancies ─────────────────── */}
      {activeSessionId && (
        <Card className="animate-in fade-in slide-in-from-top-4 duration-300 relative shadow-sm rounded-md border-border">
          {discFetching && !discLoading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-md">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <CardHeader className="flex flex-col gap-4 border-b border-border bg-card">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full">
              <div className="flex flex-col gap-1 shrink-0">
                <CardTitle className="text-2xl font-bold tracking-normal flex items-center gap-2">
                  <AlertTriangle className="size-6 text-primary" />
                  Discrepancies for Run #{activeSessionId}
                </CardTitle>
                <CardDescription>Detailed breakdown of mismatches and data quality issues.</CardDescription>
              </div>

              <div className="flex items-center gap-3 ml-auto flex-wrap">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search order or transaction..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>

                <div className="relative">
                  <select
                    className="h-10 w-[140px] appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                  >
                    <option value="">All Severities</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-3">
                    <Filter className="size-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="relative">
                  <select
                    className="h-10 w-[200px] appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-3">
                    <Filter className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium pr-1">Active Filters:</span>
                {search && (
                  <Badge variant="secondary" className="flex items-center gap-1 rounded-sm px-2 font-normal">
                    Search: "{search}"
                    <button onClick={() => removeFilter('search')} className="hover:text-foreground ml-1"><X className="size-3" /></button>
                  </Badge>
                )}
                {severityFilter && (
                  <Badge variant="secondary" className="flex items-center gap-1 rounded-sm px-2 font-normal">
                    Severity: {severityFilter}
                    <button onClick={() => removeFilter('severity')} className="hover:text-foreground ml-1"><X className="size-3" /></button>
                  </Badge>
                )}
                {typeFilter && (
                  <Badge variant="secondary" className="flex items-center gap-1 rounded-sm px-2 font-normal">
                    Type: {TYPE_LABELS[typeFilter] || typeFilter}
                    <button onClick={() => removeFilter('type')} className="hover:text-foreground ml-1"><X className="size-3" /></button>
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-end mb-4">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-500 rounded-md blur opacity-30 group-hover:opacity-80 transition duration-500 group-hover:duration-200 animate-pulse"></div>
                <Button 
                  onClick={() => setShowAiModal(true)}
                  className="relative bg-card text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground hover:border-transparent shadow-sm transition-all duration-300 h-10"
                >
                  <Sparkles className="size-4 mr-2 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
                  AI Summary
                </Button>
              </div>
            </div>

            <div className="rounded-md border-2 border-border/80 overflow-hidden shadow-md">
              <Table>
                <TableHeader className="bg-muted/40 uppercase text-xs font-bold tracking-wider">
                  <TableRow>
                    <TableHead className="w-[140px]">Severity</TableHead>
                    <TableHead className="w-[200px]">Type</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead className="w-[140px]">Risk Amt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discLoading ? (
                    Array.from({ length: perPage }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5} className="h-14"><Skeleton className="h-4 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : discData?.items?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <CheckCircle2 className="size-8 opacity-50" />
                          <p>No discrepancies match your filters.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    discData?.items?.map((item) => (
                      <TableRow
                        key={item.id}
                        onClick={() => {
                          setSelectedRow(item)
                          explainMutation.reset()
                        }}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>
                          <SeverityIndicator severity={item.severity} />
                        </TableCell>
                        <TableCell className="font-medium text-sm text-foreground">
                          {TYPE_LABELS[item.discrepancy_type] || item.discrepancy_type}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.order_id || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">{item.transaction_ref || '—'}</TableCell>
                        <TableCell className="tabular-nums font-semibold text-foreground">
                          ${(item.risk_amount || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          {!discLoading && discData && (
            <CardFooter className="flex items-center justify-between border-t border-border p-4 bg-muted/10">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Showing <span className="font-medium text-foreground">{((page - 1) * perPage) + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * perPage, discData.total)}</span> of <span className="font-medium text-foreground">{discData.total}</span> entries
                </span>
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    className="h-8 w-16 appearance-none rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-row items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="size-8">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm font-medium text-foreground mx-2">
                  Page {page} of {discData.pages || 1}
                </span>
                <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(discData.pages, p + 1))} disabled={page >= (discData.pages || 1)} className="size-8">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      {/* ── AI Summary Modal ─────────────────────────────────────── */}
      <RunAiSummaryModal 
        sessionId={activeSessionId} 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)} 
      />

      {/* ── Discrepancy Detail Sheet ───────────────────────────────── */}
      <Sheet open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent
          className="flex flex-col p-0 gap-0"
          style={{ width: '50vw', minWidth: '700px', maxWidth: '1100px' }}
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Discrepancy Detail</SheetTitle>
          </SheetHeader>
          {selectedRow && (
            <DiscrepancySheet
              row={selectedRow}
              onClose={() => setSelectedRow(null)}
              explainMutation={explainMutation}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
