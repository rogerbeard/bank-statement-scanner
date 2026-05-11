import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Save,
  Trash2, Plus, Layers, Info, Zap, Loader2, RotateCcw
} from 'lucide-react'
import { getRegions, saveRegion, deleteRegion, updateRegion, extractTransactions, type Region } from '../lib/api'
import { cn, REGION_COLORS, REGION_LABELS } from '../lib/utils'

type RegionType = 'page_header' | 'group_header' | 'detail_rows'
type DrawState = { startX: number; startY: number; currentX: number; currentY: number } | null

const REGION_TYPES: { value: RegionType; label: string; desc: string }[] = [
  { value: 'page_header', label: 'Page Header', desc: 'Bank name, account info, statement period' },
  { value: 'group_header', label: 'Group Header', desc: 'Section titles, column headers' },
  { value: 'detail_rows', label: 'Detail Rows', desc: 'Transaction rows with date, description, amounts' },
]

export default function ReviewPage() {
  const { statementId } = useParams<{ statementId: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1.0)
  const [regions, setRegions] = useState<Region[]>([])
  const [selectedType, setSelectedType] = useState<RegionType>('detail_rows')
  const [drawState, setDrawState] = useState<DrawState>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [applyToAll, setApplyToAll] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 })

  // Load page count
  useEffect(() => {
    if (!statementId) return
    fetch(`/api/statements/${statementId}`)
      .then(r => r.json())
      .then(d => setPageCount(d.pageCount || 1))
      .catch(() => {})
  }, [statementId])

  // Load regions
  useEffect(() => {
    if (!statementId) return
    getRegions(statementId).then(r => setRegions(r.data)).catch(() => {})
  }, [statementId])

  // Load page image
  useEffect(() => {
    setImageLoaded(false)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      setImageLoaded(true)
    }
    img.onerror = () => setImageLoaded(false)
    img.src = `/api/statements/${statementId}/page/${currentPage}`
  }, [statementId, currentPage])

  // Draw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imageLoaded) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const displayW = img.naturalWidth * zoom
    const displayH = img.naturalHeight * zoom
    canvas.width = displayW
    canvas.height = displayH

    // Draw image
    ctx.drawImage(img, 0, 0, displayW, displayH)

    // Draw saved regions for current page
    const pageRegions = regions.filter(r => r.pageIndex === currentPage || r.applyToAllPages)
    pageRegions.forEach(r => {
      const color = REGION_COLORS[r.type]
      const x = r.x * zoom
      const y = r.y * zoom
      const w = r.width * zoom
      const h = r.height * zoom

      // Fill
      ctx.fillStyle = color + '22'
      ctx.fillRect(x, y, w, h)

      // Border
      ctx.strokeStyle = color
      ctx.lineWidth = selectedRegion === r.id ? 2.5 : 1.5
      ctx.setLineDash(selectedRegion === r.id ? [] : [4, 3])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])

      // Corner marks (CAD style)
      const markSize = 8
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      // TL
      ctx.beginPath(); ctx.moveTo(x, y + markSize); ctx.lineTo(x, y); ctx.lineTo(x + markSize, y); ctx.stroke()
      // TR
      ctx.beginPath(); ctx.moveTo(x + w - markSize, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + markSize); ctx.stroke()
      // BL
      ctx.beginPath(); ctx.moveTo(x, y + h - markSize); ctx.lineTo(x, y + h); ctx.lineTo(x + markSize, y + h); ctx.stroke()
      // BR
      ctx.beginPath(); ctx.moveTo(x + w - markSize, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - markSize); ctx.stroke()

      // Label
      ctx.fillStyle = color
      ctx.font = `bold 10px "JetBrains Mono", monospace`
      const labelText = REGION_LABELS[r.type].toUpperCase()
      const textW = ctx.measureText(labelText).width
      ctx.fillStyle = color + 'dd'
      ctx.fillRect(x, y - 16, textW + 10, 16)
      ctx.fillStyle = '#fff'
      ctx.fillText(labelText, x + 5, y - 4)
    })

    // Draw active drag region
    if (drawState) {
      const x = Math.min(drawState.startX, drawState.currentX)
      const y = Math.min(drawState.startY, drawState.currentY)
      const w = Math.abs(drawState.currentX - drawState.startX)
      const h = Math.abs(drawState.currentY - drawState.startY)
      const color = REGION_COLORS[selectedType]

      ctx.fillStyle = color + '33'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])

      // Dimension labels
      ctx.fillStyle = color
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.fillText(`${Math.round(w / zoom)}×${Math.round(h / zoom)}px`, x + 4, y + 14)
    }
  }, [regions, currentPage, zoom, drawState, selectedRegion, selectedType, imageLoaded])

  useEffect(() => { redraw() }, [redraw])

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height),
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const { x, y } = getCanvasCoords(e)
    // Check if clicking existing region
    const hit = regions.find(r => {
      if (r.pageIndex !== currentPage && !r.applyToAllPages) return false
      const rx = r.x * zoom, ry = r.y * zoom, rw = r.width * zoom, rh = r.height * zoom
      return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
    })
    if (hit) {
      setSelectedRegion(hit.id)
    } else {
      setSelectedRegion(null)
      setDrawState({ startX: x, startY: y, currentX: x, currentY: y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawState) return
    const { x, y } = getCanvasCoords(e)
    setDrawState(prev => prev ? { ...prev, currentX: x, currentY: y } : null)
  }

  const handleMouseUp = async () => {
    if (!drawState || !statementId) { setDrawState(null); return }
    const x = Math.min(drawState.startX, drawState.currentX) / zoom
    const y = Math.min(drawState.startY, drawState.currentY) / zoom
    const w = Math.abs(drawState.currentX - drawState.startX) / zoom
    const h = Math.abs(drawState.currentY - drawState.startY) / zoom
    setDrawState(null)
    if (w < 10 || h < 10) return

    try {
      const res = await saveRegion({
        statementId,
        pageIndex: currentPage,
        type: selectedType,
        label: REGION_LABELS[selectedType],
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
        applyToAllPages: applyToAll,
      })
      setRegions(prev => [...prev, res.data])
      toast.success(`${REGION_LABELS[selectedType]} region saved`)
    } catch {
      toast.error('Failed to save region')
    }
  }

  const handleDeleteRegion = async (id: string) => {
    try {
      await deleteRegion(id)
      setRegions(prev => prev.filter(r => r.id !== id))
      if (selectedRegion === id) setSelectedRegion(null)
      toast.success('Region deleted')
    } catch {
      toast.error('Failed to delete region')
    }
  }

  const handleExtract = async () => {
    if (!statementId) return
    setExtracting(true)
    try {
      const res = await extractTransactions(statementId)
      toast.success(`Extracted ${res.data.count} transactions`)
      navigate('/grid')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Extraction failed — check your AI settings')
    } finally {
      setExtracting(false)
    }
  }

  const pageRegions = regions.filter(r => r.pageIndex === currentPage || r.applyToAllPages)

  return (
    <div className="flex h-full animate-fade-in">
      {/* Left: PDF viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-blueprint-border bg-blueprint-surface flex items-center gap-3">
          <button onClick={() => navigate('/upload')} className="bp-btn py-1.5 px-2.5 text-xs">
            <ChevronLeft size={12} /> Back
          </button>

          <div className="w-px h-5 bg-blueprint-border" />

          {/* Page nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="bp-btn py-1 px-2 text-xs disabled:opacity-30"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="text-xs font-mono text-blueprint-dim px-2">
              PAGE <span className="text-blueprint-white">{currentPage + 1}</span> / {pageCount || '?'}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min((pageCount || 1) - 1, p + 1))}
              disabled={currentPage >= (pageCount || 1) - 1}
              className="bp-btn py-1 px-2 text-xs disabled:opacity-30"
            >
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="w-px h-5 bg-blueprint-border" />

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="bp-btn py-1 px-2 text-xs">
              <ZoomOut size={12} />
            </button>
            <span className="text-xs font-mono text-blueprint-dim w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="bp-btn py-1 px-2 text-xs">
              <ZoomIn size={12} />
            </button>
            <button onClick={() => setZoom(1)} className="bp-btn py-1 px-2 text-xs">
              <RotateCcw size={10} />
            </button>
          </div>

          <div className="flex-1" />

          <button
            onClick={handleExtract}
            disabled={extracting}
            className="bp-btn-primary py-1.5 px-3 text-xs"
          >
            {extracting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {extracting ? 'Extracting...' : 'Extract Transactions'}
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-blueprint-bg p-4">
          {!imageLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-blueprint-dim">
                <Loader2 size={32} className="animate-spin text-blueprint-accent" />
                <span className="text-sm font-mono">RENDERING PAGE...</span>
              </div>
            </div>
          ) : (
            <div className="inline-block">
              <canvas
                ref={canvasRef}
                className="block cursor-crosshair"
                style={{ maxWidth: '100%', imageRendering: 'pixelated' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { if (drawState) setDrawState(null) }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Region tools panel */}
      <div className="w-72 flex-shrink-0 border-l border-blueprint-border bg-blueprint-surface flex flex-col">
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-blueprint-border">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-blueprint-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blueprint-dim">
              Region Tools
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Region type selector */}
          <div>
            <div className="bp-label mb-2">Capture Type</div>
            <div className="space-y-1.5">
              {REGION_TYPES.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setSelectedType(value)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded border transition-all',
                    selectedType === value
                      ? 'border-opacity-60 bg-opacity-10'
                      : 'border-blueprint-border hover:border-blueprint-line bg-transparent'
                  )}
                  style={selectedType === value ? {
                    borderColor: REGION_COLORS[value],
                    backgroundColor: REGION_COLORS[value] + '15',
                  } : {}}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: REGION_COLORS[value] }}
                    />
                    <span className="text-sm font-semibold text-blueprint-white">{label}</span>
                  </div>
                  <div className="text-[11px] font-mono text-blueprint-dim mt-0.5 pl-4.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Apply to all pages toggle */}
          <div>
            <div className="bp-label mb-2">Scope</div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setApplyToAll(v => !v)}
                className={cn(
                  'w-9 h-5 rounded-full border transition-all relative',
                  applyToAll
                    ? 'bg-blueprint-accent border-blueprint-accent'
                    : 'bg-blueprint-bg border-blueprint-border'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                  applyToAll ? 'left-4' : 'left-0.5'
                )} />
              </div>
              <div>
                <div className="text-sm text-blueprint-white">Apply to all pages</div>
                <div className="text-[11px] font-mono text-blueprint-dim">
                  {applyToAll ? 'All pages' : `Page ${currentPage + 1} only`}
                </div>
              </div>
            </label>
          </div>

          {/* Instructions */}
          <div className="bp-panel p-3">
            <div className="flex items-start gap-2">
              <Info size={12} className="text-blueprint-accent mt-0.5 flex-shrink-0" />
              <div className="text-[11px] font-mono text-blueprint-dim leading-relaxed">
                Select a capture type above, then <span className="text-blueprint-white">click and drag</span> on the PDF to define a region. Regions are saved automatically.
              </div>
            </div>
          </div>

          {/* Saved regions for this page */}
          <div>
            <div className="bp-label mb-2">
              Regions on Page {currentPage + 1}
              <span className="ml-2 text-blueprint-accent">[{pageRegions.length}]</span>
            </div>
            {pageRegions.length === 0 ? (
              <div className="text-[11px] font-mono text-blueprint-dim/60 text-center py-4 border border-dashed border-blueprint-border/40 rounded">
                NO REGIONS DEFINED
              </div>
            ) : (
              <div className="space-y-1.5">
                {pageRegions.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRegion(selectedRegion === r.id ? null : r.id)}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 rounded border cursor-pointer transition-all',
                      selectedRegion === r.id
                        ? 'border-blueprint-accent bg-blueprint-accent/10'
                        : 'border-blueprint-border hover:border-blueprint-line'
                    )}
                  >
                    <div
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: REGION_COLORS[r.type] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-blueprint-white">{r.label}</div>
                      <div className="text-[10px] font-mono text-blueprint-dim">
                        {r.x},{r.y} · {r.width}×{r.height}
                        {r.applyToAllPages && ' · ALL PAGES'}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteRegion(r.id) }}
                      className="text-blueprint-dim hover:text-status-error transition-colors p-0.5"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Extract button */}
        <div className="p-4 border-t border-blueprint-border">
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="w-full bp-btn-primary justify-center py-2.5"
          >
            {extracting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {extracting ? 'Extracting...' : 'Extract Transactions'}
          </button>
          <div className="text-[10px] font-mono text-blueprint-dim/60 text-center mt-2">
            AI-POWERED · ALL PAGES PROCESSED
          </div>
        </div>
      </div>
    </div>
  )
}
