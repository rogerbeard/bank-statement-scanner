const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { execSync, exec } = require('child_process')
const { promisify } = require('util')
const { v4: uuidv4 } = require('uuid')

const execAsync = promisify(exec)

// ─── Paths (injected by Electron main or fallback for standalone dev) ─────────

const UPLOADS_DIR = process.env.BSS_UPLOADS_DIR || path.join(__dirname, '..', 'uploads')
const DATA_DIR    = process.env.BSS_DATA_DIR    || path.join(__dirname, '..', 'data')
const PDFTOPPM    = process.env.BSS_PDFTOPPM    || 'pdftoppm'

// Renderer build (served as static files)
const RENDERER_DIST = path.join(__dirname, '..', 'renderer', 'dist')

for (const dir of [UPLOADS_DIR, DATA_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── JSON "database" ──────────────────────────────────────────────────────────

const DB_FILE     = path.join(DATA_DIR, 'db.json')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')

function readDb() {
  if (!fs.existsSync(DB_FILE)) return { statements: [], regions: [], transactions: [] }
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }
  catch { return { statements: [], regions: [], transactions: [] } }
}
function writeDb(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)) }

function readSettings() {
  const defaults = { aiProvider: 'openai', apiKey: '', ollamaUrl: 'http://localhost:11434', ollamaModel: 'llava', defaultExportFormat: 'combined' }
  if (!fs.existsSync(CONFIG_FILE)) return defaults
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } }
  catch { return defaults }
}
function writeSettings(s) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(s, null, 2)) }

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static(UPLOADS_DIR))

// Serve built renderer
if (fs.existsSync(RENDERER_DIST)) {
  app.use(express.static(RENDERER_DIST))
}

// Multer
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}.pdf`),
})
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

// ─── Statements ───────────────────────────────────────────────────────────────

app.get('/api/statements', (req, res) => res.json(readDb().statements))

app.get('/api/statements/:id', (req, res) => {
  const stmt = readDb().statements.find(s => s.id === req.params.id)
  if (!stmt) return res.status(404).json({ error: 'Not found' })
  res.json(stmt)
})

app.post('/api/statements/upload', upload.array('files'), async (req, res) => {
  const db = readDb()
  const created = []
  for (const file of req.files) {
    let pageCount = 1
    try {
      const { stdout } = await execAsync(`pdfinfo "${file.path}" 2>/dev/null | grep Pages | awk '{print $2}'`)
      pageCount = parseInt(stdout.trim()) || 1
    } catch {}
    const stmt = {
      id: uuidv4(), filename: file.filename, originalName: file.originalname,
      pageCount, uploadedAt: new Date().toISOString(), status: 'uploaded',
      bankName: null, accountNumber: null, statementPeriod: null,
    }
    db.statements.push(stmt)
    created.push(stmt)
    renderPages(file.path, stmt.id).catch(console.error)
  }
  writeDb(db)
  res.json(created)
})

app.delete('/api/statements/:id', (req, res) => {
  const db = readDb()
  const stmt = db.statements.find(s => s.id === req.params.id)
  if (stmt) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, stmt.filename)) } catch {}
    const pagesDir = path.join(UPLOADS_DIR, `pages_${stmt.id}`)
    if (fs.existsSync(pagesDir)) {
      fs.readdirSync(pagesDir).forEach(f => fs.unlinkSync(path.join(pagesDir, f)))
      fs.rmdirSync(pagesDir)
    }
  }
  db.statements = db.statements.filter(s => s.id !== req.params.id)
  db.regions = db.regions.filter(r => r.statementId !== req.params.id)
  db.transactions = db.transactions.filter(t => t.statementId !== req.params.id)
  writeDb(db)
  res.json({ success: true })
})

// ─── Page images ──────────────────────────────────────────────────────────────

async function renderPages(pdfPath, statementId) {
  const pagesDir = path.join(UPLOADS_DIR, `pages_${statementId}`)
  if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true })
  try {
    await execAsync(`"${PDFTOPPM}" -r 150 -png "${pdfPath}" "${path.join(pagesDir, 'page')}"`)
  } catch (e) {
    console.error('Page render error:', e.message)
    // Fallback: try system pdftoppm
    try {
      await execAsync(`pdftoppm -r 150 -png "${pdfPath}" "${path.join(pagesDir, 'page')}"`)
    } catch {}
  }
}

app.get('/api/statements/:id/page/:pageIndex', (req, res) => {
  const { id, pageIndex } = req.params
  const pagesDir = path.join(UPLOADS_DIR, `pages_${id}`)
  if (fs.existsSync(pagesDir)) {
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.png')).sort()
    const idx = parseInt(pageIndex)
    if (files[idx]) return res.sendFile(path.join(pagesDir, files[idx]))
  }
  res.status(404).json({ error: 'Page not rendered yet' })
})

app.get('/api/statements/:id/page-status', (req, res) => {
  const pagesDir = path.join(UPLOADS_DIR, `pages_${req.params.id}`)
  const count = fs.existsSync(pagesDir)
    ? fs.readdirSync(pagesDir).filter(f => f.endsWith('.png')).length
    : 0
  res.json({ count })
})

// ─── Regions ──────────────────────────────────────────────────────────────────

app.get('/api/regions/:statementId', (req, res) => {
  res.json(readDb().regions.filter(r => r.statementId === req.params.statementId))
})
app.post('/api/regions', (req, res) => {
  const db = readDb()
  const region = { id: uuidv4(), ...req.body }
  db.regions.push(region)
  writeDb(db)
  res.json(region)
})
app.put('/api/regions/:id', (req, res) => {
  const db = readDb()
  const idx = db.regions.findIndex(r => r.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  db.regions[idx] = { ...db.regions[idx], ...req.body }
  writeDb(db)
  res.json(db.regions[idx])
})
app.delete('/api/regions/:id', (req, res) => {
  const db = readDb()
  db.regions = db.regions.filter(r => r.id !== req.params.id)
  writeDb(db)
  res.json({ success: true })
})

// ─── LLM Extraction ───────────────────────────────────────────────────────────

async function extractWithLLM(imageBase64, regions, settings) {
  const regionDesc = regions.length
    ? regions.map(r => `- ${r.label} (${r.type}): x=${Math.round(r.x)}, y=${Math.round(r.y)}, w=${Math.round(r.width)}, h=${Math.round(r.height)}`).join('\n')
    : '(No regions defined — extract all visible transactions from the page)'

  const prompt = `You are analyzing a bank statement image. Extract ALL transaction rows from the detail rows area.

Defined regions:
${regionDesc}

Return a JSON array of transaction objects with EXACTLY these fields:
- date: string (YYYY-MM-DD or as shown, e.g. "2025-05-01")
- description: string (full transaction description/payee)
- debit: number or null (withdrawal amount, digits only, no $ sign)
- credit: number or null (deposit/credit amount, digits only, no $ sign)
- balance: number or null (running balance, digits only, no $ sign)

Rules:
- Include ALL transaction rows, even partial ones
- Do NOT include header rows, summary rows, or section titles
- Numbers must be plain floats (e.g. 1234.56), not strings
- Return ONLY the JSON array, no explanation or markdown

Example: [{"date":"2025-05-05","description":"INCOMING FEDWIRE TRANSFER","debit":null,"credit":24902.27,"balance":26888.66}]`

  if (settings.aiProvider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: prompt },
        ]}],
        max_tokens: 4096,
      }),
    })
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'OpenAI error') }
    const data = await resp.json()
    const content = data.choices[0].message.content
    const match = content.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  }

  if (settings.aiProvider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', max_tokens: 4096,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: prompt },
        ]}],
      }),
    })
    if (!resp.ok) { const e = await resp.json(); throw new Error(e.error?.message || 'Anthropic error') }
    const data = await resp.json()
    const content = data.content[0].text
    const match = content.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  }

  if (settings.aiProvider === 'ollama') {
    const resp = await fetch(`${settings.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: settings.ollamaModel || 'llava', prompt, images: [imageBase64], stream: false }),
    })
    if (!resp.ok) throw new Error('Ollama error')
    const data = await resp.json()
    const match = (data.response || '').match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  }

  throw new Error('No AI provider configured. Go to Settings and add your API key.')
}

async function autoCategorize(transactions, settings) {
  if (!transactions.length) return transactions
  // Keyword fallback (always works without API)
  const keyword = t => {
    const d = (t.description || '').toLowerCase()
    if (/payroll|salary|wages|direct dep/i.test(d)) return 'Payroll & Income'
    if (/transfer|xfer|wire/i.test(d)) return 'Transfers'
    if (/amex|visa|mastercard|discover/i.test(d)) return 'Vendor Payments'
    if (/electric|gas|water|utility|pg&e|con ed/i.test(d)) return 'Utilities'
    if (/rent|lease|property/i.test(d)) return 'Rent & Lease'
    if (/insurance|insur/i.test(d)) return 'Insurance'
    if (/service charge|fee|maintenance/i.test(d)) return 'Banking Fees'
    if (/irs|tax|revenue/i.test(d)) return 'Tax Payments'
    if (/loan|mortgage/i.test(d)) return 'Loan Payments'
    if (/amazon|office|supply/i.test(d)) return 'Office Supplies'
    if (/uber|lyft|airline|hotel|travel/i.test(d)) return 'Travel & Transport'
    if (/restaurant|food|coffee|doordash/i.test(d)) return 'Meals & Entertainment'
    if (/software|subscription|saas|adobe|google|microsoft/i.test(d)) return 'Software & Subscriptions'
    if (/refund|reversal|credit adj/i.test(d)) return 'Refunds & Credits'
    return 'Other'
  }

  // Try AI categorization if key available
  if (settings.apiKey || settings.aiProvider === 'ollama') {
    try {
      const descriptions = transactions.map(t => t.description).join('\n')
      const categories = ['Payroll & Income','Transfers','Vendor Payments','Utilities','Rent & Lease','Insurance','Banking Fees','Tax Payments','Loan Payments','Office Supplies','Travel & Transport','Meals & Entertainment','Software & Subscriptions','Marketing & Advertising','Professional Services','Equipment & Hardware','Refunds & Credits','Other']
      const catPrompt = `Categorize each bank transaction description into one of: ${categories.join(', ')}.\n\nDescriptions (one per line):\n${descriptions}\n\nReturn a JSON array of category strings in the same order. Example: ["Transfers","Banking Fees"]`

      let content = ''
      if (settings.aiProvider === 'openai') {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: catPrompt }], max_tokens: 1024 }),
        })
        const d = await r.json()
        content = d.choices?.[0]?.message?.content || ''
      } else if (settings.aiProvider === 'anthropic') {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1024, messages: [{ role: 'user', content: catPrompt }] }),
        })
        const d = await r.json()
        content = d.content?.[0]?.text || ''
      }
      const match = content.match(/\[[\s\S]*\]/)
      if (match) {
        const cats = JSON.parse(match[0])
        return transactions.map((t, i) => ({ ...t, category: cats[i] || keyword(t) }))
      }
    } catch (e) {
      console.error('AI categorization failed, using keywords:', e.message)
    }
  }

  return transactions.map(t => ({ ...t, category: keyword(t) }))
}

app.post('/api/extract/:statementId', async (req, res) => {
  const db = readDb()
  const settings = readSettings()
  const stmt = db.statements.find(s => s.id === req.params.statementId)
  if (!stmt) return res.status(404).json({ error: 'Statement not found' })

  stmt.status = 'processing'
  writeDb(db)

  try {
    const pagesDir = path.join(UPLOADS_DIR, `pages_${stmt.id}`)
    if (!fs.existsSync(pagesDir) || !fs.readdirSync(pagesDir).length) {
      await renderPages(path.join(UPLOADS_DIR, stmt.filename), stmt.id)
    }

    const pageFiles = fs.existsSync(pagesDir)
      ? fs.readdirSync(pagesDir).filter(f => f.endsWith('.png')).sort().map(f => path.join(pagesDir, f))
      : []

    const regions = db.regions.filter(r => r.statementId === stmt.id)
    db.transactions = db.transactions.filter(t => t.statementId !== stmt.id)

    let all = []
    let rowIndex = 0

    for (let pi = 0; pi < pageFiles.length; pi++) {
      if (!fs.existsSync(pageFiles[pi])) continue
      const imageBase64 = fs.readFileSync(pageFiles[pi]).toString('base64')
      const pageRegions = regions.filter(r => r.pageIndex === pi || r.applyToAllPages)
      try {
        const extracted = await extractWithLLM(imageBase64, pageRegions, settings)
        for (const tx of extracted) {
          if (!tx.description && !tx.date) continue
          all.push({
            id: uuidv4(), statementId: stmt.id, pageIndex: pi,
            date: tx.date || '', description: tx.description || '',
            debit: typeof tx.debit === 'number' ? tx.debit : null,
            credit: typeof tx.credit === 'number' ? tx.credit : null,
            balance: typeof tx.balance === 'number' ? tx.balance : null,
            category: 'Other', notes: '', rowIndex: rowIndex++,
          })
        }
      } catch (e) {
        console.error(`Page ${pi} extraction error:`, e.message)
        if (!settings.apiKey && settings.aiProvider !== 'ollama') throw e
      }
    }

    all = await autoCategorize(all, settings)
    db.transactions.push(...all)
    stmt.status = 'done'
    writeDb(db)
    res.json({ count: all.length })
  } catch (e) {
    console.error('Extraction failed:', e)
    const dbNow = readDb()
    const s = dbNow.statements.find(s => s.id === req.params.statementId)
    if (s) { s.status = 'error'; writeDb(dbNow) }
    res.status(500).json({ error: e.message || 'Extraction failed' })
  }
})

// ─── Transactions ─────────────────────────────────────────────────────────────

app.get('/api/transactions', (req, res) => {
  const db = readDb()
  const txs = req.query.statementId
    ? db.transactions.filter(t => t.statementId === req.query.statementId)
    : db.transactions
  res.json(txs.sort((a, b) => {
    if (a.statementId !== b.statementId) return a.statementId.localeCompare(b.statementId)
    return (a.rowIndex || 0) - (b.rowIndex || 0)
  }))
})
app.post('/api/transactions', (req, res) => {
  const db = readDb()
  const tx = { id: uuidv4(), ...req.body }
  db.transactions.push(tx)
  writeDb(db)
  res.json(tx)
})
app.put('/api/transactions/:id', (req, res) => {
  const db = readDb()
  const idx = db.transactions.findIndex(t => t.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  db.transactions[idx] = { ...db.transactions[idx], ...req.body }
  writeDb(db)
  res.json(db.transactions[idx])
})
app.delete('/api/transactions/:id', (req, res) => {
  const db = readDb()
  db.transactions = db.transactions.filter(t => t.id !== req.params.id)
  writeDb(db)
  res.json({ success: true })
})

// ─── Export ───────────────────────────────────────────────────────────────────

app.get('/api/export/excel', async (req, res) => {
  const XLSX = require('xlsx')
  const db = readDb()
  const { statementId } = req.query
  const txs = statementId ? db.transactions.filter(t => t.statementId === statementId) : db.transactions
  const stmts = statementId ? db.statements.filter(s => s.id === statementId) : db.statements

  const wb = XLSX.utils.book_new()

  for (const stmt of stmts) {
    const rows = txs.filter(t => t.statementId === stmt.id).map(t => ({
      Date: t.date, Description: t.description,
      Debit: t.debit, Credit: t.credit, Balance: t.balance,
      Category: t.category, Notes: t.notes,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
      if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: '0A1628' } } }
    }
    XLSX.utils.book_append_sheet(wb, ws, stmt.originalName.replace('.pdf', '').slice(0, 31))
  }

  // Combined sheet
  const allRows = txs.map(t => {
    const s = db.statements.find(s => s.id === t.statementId)
    return { Statement: s?.originalName || '', Date: t.date, Description: t.description, Debit: t.debit, Credit: t.credit, Balance: t.balance, Category: t.category, Notes: t.notes }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows), 'All Transactions')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="bank_statements.xlsx"')
  res.send(buf)
})

app.get('/api/export/csv', (req, res) => {
  const db = readDb()
  const txs = req.query.statementId
    ? db.transactions.filter(t => t.statementId === req.query.statementId)
    : db.transactions
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = 'Statement,Date,Description,Debit,Credit,Balance,Category,Notes\n'
  const rows = txs.map(t => {
    const s = db.statements.find(s => s.id === t.statementId)
    return [esc(s?.originalName || ''), esc(t.date), esc(t.description), t.debit ?? '', t.credit ?? '', t.balance ?? '', esc(t.category), esc(t.notes)].join(',')
  }).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="bank_statements.csv"')
  res.send(header + rows)
})

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => res.json(readSettings()))
app.post('/api/settings', (req, res) => { writeSettings(req.body); res.json(req.body) })

// ─── SPA fallback ─────────────────────────────────────────────────────────────

if (fs.existsSync(RENDERER_DIST)) {
  app.get('*', (req, res) => res.sendFile(path.join(RENDERER_DIST, 'index.html')))
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '4000')
app.listen(PORT, '127.0.0.1', () => {
  console.log(`BSS server running on http://localhost:${PORT}`)
})
