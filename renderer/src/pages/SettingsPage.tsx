import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Save, Eye, EyeOff, Info, Cpu, Zap, Globe, Tag, Calendar, Shield } from 'lucide-react'
import { getSettings, saveSettings, type Settings } from '../lib/api'
import { cn } from '../lib/utils'

const APP_VERSION = '1.1.2'
const BUILD_DATE = '2026'

const PROVIDERS = [
  {
    value: 'openai' as const,
    label: 'OpenAI',
    icon: Zap,
    desc: 'GPT-4o with vision — best accuracy for structured data extraction',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
    keyHint: 'Get your key at platform.openai.com',
  },
  {
    value: 'anthropic' as const,
    label: 'Anthropic Claude',
    icon: Cpu,
    desc: 'Claude 3.5 Sonnet — excellent for structured JSON extraction',
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Get your key at console.anthropic.com',
  },
  {
    value: 'ollama' as const,
    label: 'Ollama (Local)',
    icon: Globe,
    desc: 'Runs entirely offline on your Mac — no API key required',
    keyLabel: 'Not required',
    keyPlaceholder: '',
    keyHint: 'Install Ollama from ollama.ai and pull a vision model',
  },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    aiProvider: 'openai',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llava',
    defaultExportFormat: 'combined',
  })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings().then(r => setSettings(r.data)).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSettings(settings)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const provider = PROVIDERS.find(p => p.value === settings.aiProvider)!

  return (
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="bp-label mb-1">MODULE 04</div>
        <h1 className="text-2xl font-bold text-blueprint-white tracking-tight">Settings</h1>
        <p className="text-sm text-blueprint-dim mt-1 font-mono">
          Configure AI provider and extraction preferences
        </p>
      </div>

      {/* AI Provider */}
      <div className="bp-panel p-5 space-y-4">
        <div className="bp-label">AI Provider</div>
        <div className="space-y-2">
          {PROVIDERS.map(p => {
            const Icon = p.icon
            const active = settings.aiProvider === p.value
            return (
              <button
                key={p.value}
                onClick={() => setSettings(s => ({ ...s, aiProvider: p.value }))}
                className={cn(
                  'w-full text-left px-4 py-3 rounded border transition-all',
                  active
                    ? 'border-blueprint-accent bg-blueprint-accent/10'
                    : 'border-blueprint-border hover:border-blueprint-line'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded border flex items-center justify-center flex-shrink-0',
                    active ? 'border-blueprint-accent bg-blueprint-accent/20' : 'border-blueprint-border bg-blueprint-bg'
                  )}>
                    <Icon size={14} className={active ? 'text-blueprint-accent' : 'text-blueprint-dim'} />
                  </div>
                  <div className="flex-1">
                    <div className={cn('text-sm font-semibold', active ? 'text-blueprint-white' : 'text-blueprint-dim')}>
                      {p.label}
                    </div>
                    <div className="text-[11px] font-mono text-blueprint-dim mt-0.5">{p.desc}</div>
                  </div>
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0',
                    active ? 'border-blueprint-accent bg-blueprint-accent' : 'border-blueprint-border'
                  )} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* API Key */}
      {settings.aiProvider !== 'ollama' && (
        <div className="bp-panel p-5 space-y-3">
          <div className="bp-label">{provider.keyLabel}</div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={e => setSettings(s => ({ ...s, apiKey: e.target.value }))}
              placeholder={provider.keyPlaceholder}
              className="bp-input pr-10"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-blueprint-dim hover:text-blueprint-white transition-colors"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex items-start gap-2 text-[11px] font-mono text-blueprint-dim">
            <Info size={11} className="mt-0.5 flex-shrink-0 text-blueprint-accent" />
            <span>{provider.keyHint} · Stored locally in config.json on your Mac</span>
          </div>
        </div>
      )}

      {/* Ollama settings */}
      {settings.aiProvider === 'ollama' && (
        <div className="bp-panel p-5 space-y-4">
          <div className="bp-label">Ollama Configuration</div>
          <div>
            <label className="bp-label text-[10px] mb-1.5 block">Server URL</label>
            <input
              type="text"
              value={settings.ollamaUrl}
              onChange={e => setSettings(s => ({ ...s, ollamaUrl: e.target.value }))}
              className="bp-input"
              placeholder="http://localhost:11434"
            />
          </div>
          <div>
            <label className="bp-label text-[10px] mb-1.5 block">Vision Model</label>
            <input
              type="text"
              value={settings.ollamaModel}
              onChange={e => setSettings(s => ({ ...s, ollamaModel: e.target.value }))}
              className="bp-input"
              placeholder="llava"
            />
            <div className="text-[11px] font-mono text-blueprint-dim mt-1.5">
              Recommended: llava, llava-llama3, bakllava · Run: ollama pull llava
            </div>
          </div>
        </div>
      )}

      {/* Export defaults */}
      <div className="bp-panel p-5 space-y-3">
        <div className="bp-label">Default Export Mode</div>
        <div className="flex gap-2">
          {(['combined', 'separate'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSettings(s => ({ ...s, defaultExportFormat: mode }))}
              className={cn(
                'flex-1 py-2.5 rounded border text-sm font-mono transition-all',
                settings.defaultExportFormat === mode
                  ? 'border-blueprint-accent bg-blueprint-accent/10 text-blueprint-white'
                  : 'border-blueprint-border text-blueprint-dim hover:border-blueprint-line'
              )}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-mono text-blueprint-dim">
          Combined: all statements in one sheet · Separate: one sheet per statement
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="bp-btn-primary py-2.5 px-6"
      >
        <Save size={14} />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* About / Version */}
      <div className="bp-panel p-5 space-y-3">
        <div className="bp-label">About</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-blueprint-border">
            <div className="flex items-center gap-2 text-xs font-mono text-blueprint-dim">
              <Tag size={11} className="text-blueprint-accent" />
              Version
            </div>
            <div className="text-xs font-mono font-bold text-blueprint-accent tracking-widest">v{APP_VERSION}</div>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-blueprint-border">
            <div className="flex items-center gap-2 text-xs font-mono text-blueprint-dim">
              <Calendar size={11} className="text-blueprint-accent" />
              Build Year
            </div>
            <div className="text-xs font-mono text-blueprint-white">{BUILD_DATE}</div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-xs font-mono text-blueprint-dim">
              <Shield size={11} className="text-blueprint-accent" />
              Data Storage
            </div>
            <div className="text-xs font-mono text-blueprint-white">Local · Never uploaded</div>
          </div>
        </div>
        <div className="text-[11px] font-mono text-blueprint-dim pt-1">
          Bank Statement Scanner v{APP_VERSION} · AI-Powered · Local · Secure
        </div>
      </div>
    </div>
  )
}
