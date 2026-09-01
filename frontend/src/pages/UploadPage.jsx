import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/lib/api'
import { Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function FileDropZone({ label, file, onFile, accept = '.csv' }) {
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
        'relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground',
        file && 'border-green-500/50 bg-green-500/5'
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

      {file ? (
        <>
          <CheckCircle2 className="size-8 text-green-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            className="absolute top-2 right-2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onFile(null) }}
          >
            <X className="size-3.5" />
          </button>
        </>
      ) : (
        <>
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Drag & drop or click to browse · CSV only
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default function UploadPage() {
  const { api } = useApi()
  const navigate = useNavigate()
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
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed — please try again')
      setStatus('error')
    }
  }

  if (status === 'done' && result) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="size-8 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Reconciliation Complete</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {result.orders_count} orders × {result.payments_count} payments processed
            </p>
          </div>
          <div className="flex gap-6 rounded-lg border border-border bg-card p-6 w-full">
            <Stat label="Orders" value={result.orders_count} />
            <Stat label="Payments" value={result.payments_count} />
            <Stat
              label="Discrepancies"
              value={result.discrepancy_count}
              danger={result.discrepancy_count > 0}
            />
          </div>
          <button
            onClick={() => navigate(`/discrepancies/${result.session_id}`)}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View Discrepancies →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Upload Reconciliation Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your orders CSV and payments CSV. DATAClaw will reconcile them and flag every discrepancy.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FileDropZone
          label="Orders CSV"
          file={ordersFile}
          onFile={setOrdersFile}
        />
        <FileDropZone
          label="Payments CSV"
          file={paymentsFile}
          onFile={setPaymentsFile}
        />
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        disabled={!canSubmit}
        onClick={handleUpload}
        className={cn(
          'mt-6 w-full inline-flex h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition-all',
          canSubmit
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {status === 'uploading' ? (
          <>
            <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Reconciling…
          </>
        ) : (
          <>
            <FileText className="size-4" />
            Run Reconciliation
          </>
        )}
      </button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Required columns: <span className="font-mono">order_id, net_amount, currency, status</span> (orders) ·{' '}
        <span className="font-mono">transaction_ref, order_reference, amount, type, status</span> (payments)
      </p>
    </div>
  )
}

function Stat({ label, value, danger }) {
  return (
    <div className="flex-1 text-center">
      <p className={cn('text-2xl font-bold tabular', danger && value > 0 ? 'text-red-400' : 'text-foreground')}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
