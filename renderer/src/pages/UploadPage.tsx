import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import {
  Upload, FileText, Trash2, Eye, Zap, CheckCircle,
  AlertCircle, Loader2, X, ChevronRight, FileSearch, Grid3X3
} from 'lucide-react'
import {
  getStatements, uploadStatements, deleteStatement,
  extractTransactions, type Statement
} from '../lib/api'
import { cn } from '../lib/utils'

const STATUS_CONFIG = {
  uploaded: { color: 'text-blueprint-accent', bg: 'bg-blueprint-accent/10', icon: FileText, label: 'UPLOADED' },
  processing: { color: 'text-status-warning', bg: 'bg-status-warning/10', icon: Loader2, label: 'PROCESSING' },
  done: { color: 'text-status-success', bg: 'bg-status-success/10', icon: CheckCircle, label: 'COMPLETE' },
  error: { color: 'text-status-error', bg: 'bg-status-error/10', icon: AlertCircle, label: 'ERROR' },
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [statements, setStatements] = useState<Statement[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [extractingId, setExtractingId] = useState<string | null>(null)

  const loadStatements = useCallback(async () => {
    try {
      const res = await getStatements()
      setStatements(res.data)
    } catch {
      // server may not be ready yet
    }
  }, [])

  useEffect(() => {
    loadStatements()
  }, [loadStatements])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const pdfs = acceptedFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfs.length === 0) {
      toast.error('Please upload PDF files only')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await uploadStatements(pdfs, setUploadProgress)
      toast.success(`${res.data.length} statement(s) uploaded successfully`)
      await loadStatements()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [loadStatements])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: uploading,
  })

  const handleDelete = async (id: string) => {
    try {
      await deleteStatement(id)
      setStatements(prev => prev.filter(s => s.id !== id))
      toast.success('Statement removed')
    } catch {
      toast.error('Failed to delete statement')
    }
  }

  const handleExtract = async (id: string) => {
    setExtractingId(id)
    setStatements(prev => prev.map(s => s.id === id ? { ...s, status: 'processing' } : s))
    try {
      const res = await extractTransactions(id)
      toast.success(`Extracted ${res.data.count} transactions`)
      setStatements(prev => prev.map(s => s.id === id ? { ...s, status: 'done' } : s))
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Extraction failed')
      setStatements(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s))
    } finally {
      setExtractingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="bp-label mb-1">MODULE 01</div>
          <h1 className="text-2xl font-bold text-blueprint-white tracking-tight">
            Statement Upload
          </h1>
          <p className="text-sm text-blueprint-dim mt-1 font-mono">
            Upload one or more bank statement PDFs for processing
          </p>
        </div>
        {statements.some(s => s.status === 'done') && (
          <button
            onClick={() => navigate('/grid')}
            className="bp-btn-primary"
          >
            <Grid3X3 size={14} />
            View Data Grid
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-200',
          'corner-marks',
          isDragActive
            ? 'border-blueprint-accent bg-blueprint-accent/5 scale-[1.01]'
            : 'border-blueprint-border hover:border-blueprint-line hover:bg-blueprint-surface/50',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} />

        {/* Grid overlay */}
        <div className="absolute inset-0 rounded-lg opacity-30 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(74,144,217,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(74,144,217,0.06) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <div className="w-16 h-16 rounded-full border border-blueprint-accent flex items-center justify-center scan-overlay">
                <Loader2 size={28} className="text-blueprint-accent animate-spin" />
              </div>
              <div>
                <div className="text-blueprint-white font-semibold">Uploading...</div>
                <div className="text-blueprint-dim text-sm font-mono mt-1">{uploadProgress}% complete</div>
              </div>
              <div className="w-48 h-1 bg-blueprint-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-blueprint-accent transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className={cn(
                'w-16 h-16 rounded-full border flex items-center justify-center transition-all',
                isDragActive ? 'border-blueprint-accent bg-blueprint-accent/10' : 'border-blueprint-border'
              )}>
                <Upload size={28} className={isDragActive ? 'text-blueprint-accent' : 'text-blueprint-dim'} />
              </div>
              <div>
                <div className="text-blueprint-white font-semibold text-lg">
                  {isDragActive ? 'Drop PDFs here' : 'Drop PDF statements here'}
                </div>
                <div className="text-blueprint-dim text-sm font-mono mt-1">
                  or click to browse · multiple files supported
                </div>
              </div>
              <div className="flex items-center gap-6 text-[11px] font-mono text-blueprint-dim/70">
                <span>FORMAT: PDF</span>
                <span>·</span>
                <span>MULTI-FILE: YES</span>
                <span>·</span>
                <span>MAX: 50MB/file</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Statements list */}
      {statements.length > 0 && (
        <div className="bp-panel overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-blueprint-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSearch size={14} className="text-blueprint-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-blueprint-dim">
                Uploaded Statements
              </span>
              <span className="bp-badge bg-blueprint-line/20 text-blueprint-accent">
                {statements.length}
              </span>
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-blueprint-border/50">
            {statements.map((stmt) => {
              const cfg = STATUS_CONFIG[stmt.status]
              const StatusIcon = cfg.icon
              const isExtracting = extractingId === stmt.id

              return (
                <div key={stmt.id} className="px-4 py-3 flex items-center gap-4 hover:bg-blueprint-surface/50 transition-colors group">
                  {/* File icon */}
                  <div className="w-9 h-9 rounded border border-blueprint-border flex items-center justify-center bg-blueprint-bg flex-shrink-0">
                    <FileText size={16} className="text-blueprint-accent" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-blueprint-white truncate">
                      {stmt.originalName}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] font-mono text-blueprint-dim">
                      <span>{stmt.pageCount} page{stmt.pageCount !== 1 ? 's' : ''}</span>
                      {stmt.bankName && <><span>·</span><span>{stmt.bankName}</span></>}
                      {stmt.statementPeriod && <><span>·</span><span>{stmt.statementPeriod}</span></>}
                      <span>·</span>
                      <span>{new Date(stmt.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className={cn('bp-badge', cfg.bg, cfg.color)}>
                    <StatusIcon size={10} className={cn(stmt.status === 'processing' && 'animate-spin')} />
                    {cfg.label}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/review/${stmt.id}`)}
                      className="bp-btn py-1.5 px-2.5 text-xs"
                      title="Review & Draw Regions"
                    >
                      <Eye size={12} />
                      Review
                    </button>
                    <button
                      onClick={() => handleExtract(stmt.id)}
                      disabled={isExtracting || stmt.status === 'processing'}
                      className={cn(
                        'bp-btn-primary py-1.5 px-2.5 text-xs',
                        (isExtracting || stmt.status === 'processing') && 'opacity-50 cursor-not-allowed'
                      )}
                      title="Extract Transactions with AI"
                    >
                      {isExtracting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Zap size={12} />
                      )}
                      Extract
                    </button>
                    <button
                      onClick={() => handleDelete(stmt.id)}
                      className="bp-btn-danger py-1.5 px-2.5 text-xs"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {statements.length === 0 && !uploading && (
        <div className="text-center py-8 text-blueprint-dim text-sm font-mono">
          NO STATEMENTS LOADED · UPLOAD PDFs ABOVE TO BEGIN
        </div>
      )}
    </div>
  )
}


