import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
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
  Activity
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
  if (severity === 'HIGH') return <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-destructive" /><span className="text-sm font-medium">High</span></div>
  if (severity === 'MEDIUM') return <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-amber-500" /><span className="text-sm font-medium">Medium</span></div>
  return <div className="flex items-center gap-2"><div className="size-2 rounded-full bg-green-500" /><span className="text-sm font-medium">Low</span></div>
}

export default function RunsPage() {
  const { api } = useApi()
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null) // For the Sheet

  // Discrepancy Table State
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

  useEffect(() => {
    setPage(1)
  }, [severityFilter, typeFilter])

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
      // update the selected row with the explanation so it renders immediately
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
      {/* ── Top Section: Runs List ───────────────────────────────────── */}
      <Card className="rounded-md border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-normal flex items-center gap-2">
            <Activity className="size-6 text-primary" />
            Reconciliation Runs
          </CardTitle>
          <CardDescription>View your past upload sessions and access their detailed discrepancy reports.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="rounded-md border-2 border-border/60 overflow-hidden shadow-sm">
            <Table>
            <TableHeader className="bg-muted/50">
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
                        isActive && "bg-muted"
                      )}
                      onClick={() => {
                        setActiveSessionId(session.id)
                        setSelectedRow(null)
                      }}
                    >
                      <TableCell className="font-medium">#{session.id}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(session.uploaded_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="truncate" title={session.orders_filename}>
                        {session.orders_filename}
                      </TableCell>
                      <TableCell className="truncate" title={session.payments_filename}>
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

      {/* ── Bottom Section: Detailed Discrepancies ───────────────────── */}
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
                  <List data-icon="inline-start" className="size-6 text-primary" />
                  Discrepancies for Run #{activeSessionId}
                </CardTitle>
                <CardDescription>Detailed breakdown of mismatches and data quality issues.</CardDescription>
              </div>
              
              <div className="flex items-center gap-3 ml-auto">
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
                    className="h-10 w-[140px] appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="h-10 w-[200px] appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* Active Filters Badges */}
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
            <div className="rounded-md border-2 border-border/60 overflow-hidden shadow-sm">
              <Table>
              <TableHeader className="bg-muted/40">
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
                      onClick={() => setSelectedRow(item)}
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
          
          {/* Pagination Controls in CardFooter */}
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
                    onChange={(e) => {
                      setPerPage(Number(e.target.value))
                      setPage(1)
                    }}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-row items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="size-8"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm font-medium text-foreground mx-2">
                  Page {page} of {discData.pages || 1}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(discData.pages, p + 1))}
                  disabled={page >= (discData.pages || 1)}
                  className="size-8"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      {/* ── Sheet: Row Details ───────────────────────────────────────── */}
      <Sheet open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent className="w-full sm:max-w-2xl sm:w-[800px] flex flex-col p-0" side="right">
          {selectedRow && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              <SheetHeader className="px-0">
                <SheetTitle className="text-2xl flex items-center gap-3">
                  <AlertTriangle className={cn(
                    "size-6",
                    selectedRow.severity === 'HIGH' ? 'text-destructive' : selectedRow.severity === 'MEDIUM' ? 'text-amber-500' : 'text-green-500'
                  )} />
                  {TYPE_LABELS[selectedRow.discrepancy_type] || selectedRow.discrepancy_type}
                </SheetTitle>
                <SheetDescription className="text-base mt-2">
                  This discrepancy represents a financial risk of <strong className="text-foreground">${(selectedRow.risk_amount || 0).toFixed(2)}</strong>.
                </SheetDescription>
              </SheetHeader>

              {/* Detail Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/20 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Order Details</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-sm text-muted-foreground">Order ID</span>
                      <span className="text-sm font-medium">{selectedRow.order_id || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-sm text-muted-foreground">Order Amount</span>
                      <span className="text-sm font-medium tabular-nums">${selectedRow.order_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span className="text-sm text-muted-foreground">Currency</span>
                      <span className="text-sm font-medium">{selectedRow.currency?.split('/')[0] || selectedRow.currency || '—'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/20 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Transaction Details</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-sm text-muted-foreground">Transaction Ref</span>
                      <span className="text-sm font-medium font-mono">{selectedRow.transaction_ref || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/50 pb-2">
                      <span className="text-sm text-muted-foreground">Payment Amount</span>
                      <span className="text-sm font-medium tabular-nums">${selectedRow.payment_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span className="text-sm text-muted-foreground">Currency</span>
                      <span className="text-sm font-medium">{selectedRow.currency?.split('/')[1] || selectedRow.currency || '—'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Explanation Section */}
              <div className="flex flex-col gap-4 mt-2 border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="size-5 text-primary" />
                    AI Root Cause Analysis
                  </h3>
                  {!selectedRow.explanation && (
                    <Button 
                      onClick={() => explainMutation.mutate(selectedRow.id)}
                      disabled={explainMutation.isPending}
                      className="shadow-sm"
                    >
                      {explainMutation.isPending ? (
                        <><Loader2 className="mr-2 size-4 animate-spin" /> Analyzing...</>
                      ) : (
                        'Generate Analysis'
                      )}
                    </Button>
                  )}
                </div>

                {explainMutation.isError && (
                  <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
                    Failed to generate explanation. Please try again.
                  </div>
                )}

                {selectedRow.explanation && (
                  <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
                      <h4 className="text-sm font-semibold text-primary mb-1">Likely Cause</h4>
                      <p className="text-sm text-foreground leading-relaxed">{selectedRow.explanation.likely_cause}</p>
                    </div>
                    
                    <div className="p-4 rounded-md bg-amber-500/5 border border-amber-500/20">
                      <h4 className="text-sm font-semibold text-amber-600 mb-1">Business Impact</h4>
                      <p className="text-sm text-foreground leading-relaxed">{selectedRow.explanation.business_impact}</p>
                    </div>

                    {selectedRow.explanation.action_items?.length > 0 && (
                      <div className="p-4 rounded-md bg-muted border border-border">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">Recommended Actions</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {selectedRow.explanation.action_items.map((item, i) => (
                            <li key={i} className="text-sm text-foreground">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
