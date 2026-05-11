import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

export interface Statement {
  id: string
  filename: string
  originalName: string
  pageCount: number
  uploadedAt: string
  status: 'uploaded' | 'processing' | 'done' | 'error'
  bankName?: string
  accountNumber?: string
  statementPeriod?: string
}

export interface Region {
  id: string
  statementId: string
  pageIndex: number
  type: 'page_header' | 'group_header' | 'detail_rows'
  label: string
  x: number
  y: number
  width: number
  height: number
  applyToAllPages: boolean
}

export interface Transaction {
  id: string
  statementId: string
  pageIndex: number
  date: string
  description: string
  debit: number | null
  credit: number | null
  balance: number | null
  category: string
  notes: string
  rowIndex: number
}

export interface Settings {
  aiProvider: 'openai' | 'anthropic' | 'ollama'
  apiKey: string
  ollamaUrl: string
  ollamaModel: string
  defaultExportFormat: 'combined' | 'separate'
}

// Statements
export const getStatements = () => api.get<Statement[]>('/statements')
export const uploadStatements = (files: File[], onProgress?: (pct: number) => void) => {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  return api.post<Statement[]>('/statements/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / (e.total || 1))),
  })
}
export const deleteStatement = (id: string) => api.delete(`/statements/${id}`)

// Regions
export const getRegions = (statementId: string) => api.get<Region[]>(`/regions/${statementId}`)
export const saveRegion = (region: Omit<Region, 'id'>) => api.post<Region>('/regions', region)
export const updateRegion = (id: string, region: Partial<Region>) => api.put<Region>(`/regions/${id}`, region)
export const deleteRegion = (id: string) => api.delete(`/regions/${id}`)

// Extraction
export const extractTransactions = (statementId: string) =>
  api.post<{ count: number }>(`/extract/${statementId}`)

// Transactions
export const getTransactions = (statementId?: string) =>
  api.get<Transaction[]>('/transactions', { params: statementId ? { statementId } : {} })
export const updateTransaction = (id: string, data: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, data)
export const deleteTransaction = (id: string) => api.delete(`/transactions/${id}`)
export const addTransaction = (data: Omit<Transaction, 'id'>) =>
  api.post<Transaction>('/transactions', data)

// Export
export const exportExcel = (statementId?: string) =>
  api.get('/export/excel', {
    params: statementId ? { statementId } : {},
    responseType: 'blob',
  })
export const exportCsv = (statementId?: string) =>
  api.get('/export/csv', {
    params: statementId ? { statementId } : {},
    responseType: 'blob',
  })

// Settings
export const getSettings = () => api.get<Settings>('/settings')
export const saveSettings = (settings: Settings) => api.post<Settings>('/settings', settings)
