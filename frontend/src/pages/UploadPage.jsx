import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import {
  Upload, FileText, AlertCircle, CheckCircle2, X,
  ArrowRight, Zap, FileSpreadsheet, Database, Activity,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const REQUIRED_COLS = {
  orders: ['order_id', 'order_date', 'customer_email', 'currency', 'gross_amount', 'discount', 'net_amount', 'status'],
  payments: ['transaction_ref', 'processed_at', 'order_reference', 'currency', 'amount', 'fee', 'net_settled', 'type', 'status'],
}

function FileDropZone({ label, description, file, onFile, accept = '.csv', icon: Icon }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 rounded-xl border-2 border-dashed p-6 transition-all duration-200 cursor-pointer group',
        dragging
          ? 'border-primary bg-primary/8 scale-[1.01]'
          : file
          ? 'border-green-500/60 bg-green-500/5'
          : 'border-border hover:border-primary/50 hover:bg-primary/3'
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-4"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-green-500/15 shrink-0">
              <CheckCircle2 className="size-6 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(file.size / 1024).toFixed(1)} KB · Ready to reconcile
              </p>
            </div>
            <button
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              onClick={(e) => { e.stopPropagation(); onFile(null) }}
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-4"
          >
            <div className={cn(
              'flex size-12 items-center justify-center rounded-xl shrink-0 transition-colors',
              dragging ? 'bg-primary/15' : 'bg-muted group-hover:bg-primary/10'
            )}>
              <Icon className={cn('size-5 transition-colors', dragging ? 'text-primary' : 'text-muted-foreground group-hover:text-primary')} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ label, value, danger }) {
  return (
    <div className="flex-1 text-center">
      <p className={cn('text-3xl font-extrabold tabular-nums', danger && value > 0 ? 'text-destructive' : 'text-foreground')}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

export default function UploadPage() {
  const { api } = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [ordersFile, setOrdersFile] = useState(null)
  const [paymentsFile, setPaymentsFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | uploading | done | error
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const canSubmit = ordersFile && paymentsFile && status !== 'uploading'

  const handleUpload = async () => {
    if (!canSubmit) return
    setStatus('uploading')
    setError(null)

    const form = new FormData()
    form.append('orders_file', ordersFile)
    form.append('payments_file', paymentsFile)

    try {
      const { data } = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      setStatus('done')
      // Invalidate sessions cache so Runs page always loads the new session
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed — please try again')
      setStatus('error')
    }
  }

  // ── Success screen ────────────────────────────────────────────────────
  if (status === 'done' && result) {
    return (
      <div className="flex items-center justify-center min-h-full p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-green-500/15 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="size-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-foreground">Reconciliation Complete</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Matched {result.orders_count} orders against {result.payments_count} payments
              </p>
            </div>
            <div className="flex gap-0 w-full rounded-xl border border-border bg-card overflow-hidden divide-x divide-border">
              <Stat label="Orders" value={result.orders_count} />
              <Stat label="Payments" value={result.payments_count} />
              <Stat label="Discrepancies" value={result.discrepancy_count} danger={result.discrepancy_count > 0} />
            </div>
            <button
              onClick={() => navigate('/runs')}
              className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-md hover:shadow-lg cursor-pointer"
            >
              View Full Report <ArrowRight className="size-4" />
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Upload form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-full flex items-start justify-center p-6 md:p-10">
      <div className="w-full">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 shadow-sm">
              <Upload className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Upload Reconciliation Data</h1>
              <p className="text-sm text-muted-foreground">
                Drop in your CSVs and DATAClaw will automatically detect every discrepancy.
              </p>
            </div>
          </div>

          {/* Process steps */}
          <div className="flex items-center gap-0 mt-5">
            {[
              { icon: FileSpreadsheet, label: 'Upload CSVs' },
              { icon: Zap,             label: 'Auto-Reconcile' },
              { icon: Database,        label: 'Store Results' },
              { icon: Activity,        label: 'View Report' },
            ].map((step, i, arr) => (
              <div key={i} className="flex items-center">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40">
                  <step.icon className="size-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground/40 mx-0.5" />}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Drop zones */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="flex flex-col gap-3 mb-5"
        >
          <FileDropZone
            label="Orders CSV"
            description="Drag & drop or click to browse · CSV files only"
            file={ordersFile}
            onFile={setOrdersFile}
            icon={FileText}
          />
          <FileDropZone
            label="Payments CSV"
            description="Drag & drop or click to browse · CSV files only"
            file={paymentsFile}
            onFile={setPaymentsFile}
            icon={FileSpreadsheet}
          />
        </motion.div>

        {/* Column reference cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { title: 'Orders', cols: REQUIRED_COLS.orders },
            { title: 'Payments', cols: REQUIRED_COLS.payments },
          ].map(({ title, cols }) => (
            <div key={title} className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">{title} — Expected Columns</p>
              <div className="flex flex-wrap gap-1">
                {cols.map((col) => (
                  <span key={col} className="inline-block rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <button
          disabled={!canSubmit}
          onClick={handleUpload}
          className={cn(
            'w-full inline-flex h-12 items-center justify-center gap-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
            canSubmit
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {status === 'uploading' ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Reconciling data…
            </>
          ) : (
            <>
              <Zap className="size-4" />
              Run Reconciliation
              {canSubmit && <ArrowRight className="size-4" />}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
