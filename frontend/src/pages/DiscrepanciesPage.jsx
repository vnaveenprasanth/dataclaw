import { useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Search, Sparkles, AlertTriangle, ChevronLeft, ChevronRight,
  ArrowUpDown, CheckCircle2, Clock, XCircle
} from 'lucide-react'
import { cn, debounce } from '@/lib/utils'

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

function SeverityBadge({ severity }) {
  const cls = {
    HIGH:   'badge-high',
    MEDIUM: 'badge-medium',
    LOW:    'badge-low',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', cls[severity] || 'badge-low')}>
      <span className={cn('size-1.5 rounded-full',
        severity === 'HIGH' ? 'dot-high' : severity === 'MEDIUM' ? 'dot-medium' : 'dot-low'
      )} />
      {severity}
    </span>
  )
}

function ExplainerSheet({ result, open, onClose }) {
  const { api } = useApi()
  const queryClient = useQueryClient()

  const { mutate: explain, isPending, error } = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/llm/explain/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discrepancies'] })
    },
  })

  const expl = result?.explanation

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:w-[480px] bg-card border-border flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="text-base font-semibold text-foreground">
            AI Analysis
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground font-mono">
            {result?.order_id} · {result?.discrepancy_type}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!expl && !isPending && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Get AI Explanation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gemini will analyse this discrepancy and suggest remediation steps
                </p>
              </div>
              <button
                onClick={() => explain(result?.id)}
                className="inline-flex items-center gap-2 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="size-3.5" />
                Explain This
              </button>
            </div>
          )}

          {isPending && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="size-3.5 animate-spin rounded-full border border-primary border-t-transparent" />
                Analysing with Gemini…
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-3/4" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">
                {error.response?.data?.error || 'Failed to get explanation — please retry'}
              </AlertDescription>
            </Alert>
          )}

          {expl && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={expl.urgency} />
                  <span className="text-xs text-muted-foreground">Urgency</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  via {expl.provider} · {expl.model_used}
                </span>
              </div>

              <Section title="Likely Cause">
                <p className="text-sm text-foreground leading-relaxed">{expl.likely_cause}</p>
              </Section>

              <Section title="Business Impact">
                <p className="text-sm text-foreground leading-relaxed">{expl.business_impact}</p>
              </Section>

              <Section title="Action Items">
                <ol className="space-y-2">
                  {expl.action_items?.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-foreground">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </Section>

              {expl.is_partial && (
                <Alert>
                  <AlertDescription className="text-xs text-muted-foreground">
                    Partial response — LLM returned incomplete data. Manual review recommended.
                  </AlertDescription>
                </Alert>
              )}

              <button
                onClick={() => explain(result?.id)}
                className="w-full inline-flex items-center justify-center gap-2 h-8 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Sparkles className="size-3" /> Re-analyse
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

const SEVERITY_FILTERS = ['', 'HIGH', 'MEDIUM', 'LOW']
const TYPE_FILTERS = ['', ...Object.keys(TYPE_LABELS)]

export default function DiscrepanciesPage() {
  const { sessionId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { api } = useApi()

  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [severity, setSeverity] = useState(searchParams.get('severity') || '')
  const [type, setType] = useState(searchParams.get('type') || '')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const debouncedSearch = useCallback(
    debounce((v) => { setSearch(v); setPage(1) }, 150),
    []
  )

  const { data, isLoading, isError } = useQuery({
    queryKey: ['discrepancies', sessionId, search, severity, type, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page,
        per_page: 50,
        sort: 'risk_amount',
        order: 'desc',
        ...(search && { q: search }),
        ...(severity && { severity }),
        ...(type && { type }),
      })
      const { data } = await api.get(`/sessions/${sessionId}/discrepancies?${params}`)
      return data
    },
  })

  const openExplainer = (result) => {
    setSelected(result)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + filters */}
      <div className="border-b border-border bg-card px-8 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            Discrepancies
            {data?.total != null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({data.total} total)
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search order ID or transaction ref…"
              className="pl-9 h-8 text-sm bg-background border-border"
              defaultValue={search}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1) }}
            className="h-8 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Severities</option>
            {['HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1) }}
            className="h-8 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : isError ? (
          <div className="p-8 text-sm text-red-400">Failed to load discrepancies</div>
        ) : data?.items?.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            No discrepancies match your filters
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs w-28">Severity</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Order ID</TableHead>
                <TableHead className="text-xs">Transaction Ref</TableHead>
                <TableHead className="text-xs text-right">Order Amt</TableHead>
                <TableHead className="text-xs text-right">Payment Amt</TableHead>
                <TableHead className="text-xs text-right">Risk $</TableHead>
                <TableHead className="text-xs w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border hover:bg-accent/40 cursor-pointer transition-colors"
                  onClick={() => openExplainer(row)}
                >
                  <TableCell><SeverityBadge severity={row.severity} /></TableCell>
                  <TableCell className="text-sm text-foreground">
                    {TYPE_LABELS[row.discrepancy_type] || row.discrepancy_type}
                  </TableCell>
                  <TableCell className="mono-id">{row.order_id || '—'}</TableCell>
                  <TableCell className="mono-id">{row.transaction_ref || '—'}</TableCell>
                  <TableCell className="text-right text-sm tabular text-muted-foreground">
                    {row.order_amount != null ? `$${parseFloat(row.order_amount).toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular text-muted-foreground">
                    {row.payment_amount != null ? `$${parseFloat(row.payment_amount).toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="risk-amount text-sm">
                      ${parseFloat(row.risk_amount).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button className="inline-flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 hover:underline">
                      <Sparkles className="size-3" />
                      {row.has_explanation ? 'View' : 'Explain'}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {data?.pages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-border py-3 bg-card">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {data.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* LLM Explainer Side Panel */}
      <ExplainerSheet
        result={selected}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
