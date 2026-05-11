# Bank Statement Scanner

AI-powered bank statement PDF scanner and data grid generator.  
Blueprint aesthetic · Runs locally on macOS · Your data never leaves your machine.

---

## Requirements

- **macOS 12+** (Monterey or later)
- **Node.js 18+** — download from [nodejs.org](https://nodejs.org)
- **poppler** (for PDF rendering) — install via Homebrew:
  ```bash
  brew install poppler
  ```
- **Homebrew** (if not installed): [brew.sh](https://brew.sh)

---

## Quick Start (Development / Run from Source)

```bash
# 1. Install all dependencies
npm run install:all

# 2. Build the renderer
npm run build:renderer

# 3. Start the app
npm start
```

The app opens in your default browser at `http://localhost:47291`.

---

## Build macOS DMG Installer

Run this once on your Mac to produce a distributable `.dmg`:

```bash
# Install dependencies first
npm run install:all

# Build renderer + package as DMG (universal: Intel + Apple Silicon)
npm run dist
```

Output files will be in `dist-electron/`:
- `Bank Statement Scanner-1.0.0-arm64.dmg` — Apple Silicon (M1/M2/M3)
- `Bank Statement Scanner-1.0.0-x64.dmg` — Intel Mac
- `Bank Statement Scanner-1.0.0-arm64-mac.zip` — ZIP for auto-update

**Install:** Open the `.dmg`, drag **Bank Statement Scanner** to **Applications**, then launch it.

> **First launch:** macOS may show a security warning for unsigned apps.  
> Go to **System Settings → Privacy & Security → Open Anyway** to allow it.  
> This is normal for apps not distributed through the Mac App Store.

---

## AI Provider Setup

Open the app → click **Settings** in the sidebar → choose your AI provider:

| Provider | Notes |
|---|---|
| **OpenAI GPT-4o** | Best accuracy. Get key at [platform.openai.com](https://platform.openai.com) |
| **Anthropic Claude** | Excellent JSON extraction. Get key at [console.anthropic.com](https://console.anthropic.com) |
| **Ollama (offline)** | No API key. Install [ollama.ai](https://ollama.ai), then run `ollama pull llava` |

Your API key is stored in `~/Library/Application Support/bank-statement-scanner/data/config.json` — never sent anywhere except the AI provider.

---

## Workflow

1. **Upload** — Drag one or more bank statement PDFs onto the upload zone
2. **Review** — Click **Review** to open the PDF viewer
   - Select a capture type: **Page Header**, **Group Header**, or **Detail Rows**
   - Click and drag on the page to draw a region
   - Resize or delete regions as needed
3. **Extract** — Click **Extract Transactions** — the AI reads your regions and pulls all transaction data
4. **Edit** — Click any cell in the **Data Grid** to correct values inline
5. **Dashboard** — View spending charts, balance over time, and monthly summaries
6. **Export** — Download as **Excel** or **CSV** from the Data Grid toolbar

---

## Data Storage

All data is stored locally in macOS user data directory:

```
~/Library/Application Support/bank-statement-scanner/
├── data/
│   ├── db.json        ← statements, regions, transactions
│   └── config.json    ← AI provider settings
└── uploads/
    ├── *.pdf          ← uploaded PDFs
    └── pages_*/       ← rendered page images
```

To reset all data: delete the folder above and restart the app.

---

## Troubleshooting

**PDF pages not rendering:**  
Make sure `poppler` is installed: `brew install poppler`  
Verify: `which pdftoppm` should return a path.

**"App is damaged" error on macOS:**  
Run: `xattr -cr /Applications/Bank\ Statement\ Scanner.app`

**Extraction returns no transactions:**  
- Check that your AI API key is valid in Settings
- Try drawing a **Detail Rows** region around the transaction table
- For Ollama: ensure the service is running (`ollama serve`) and `llava` model is pulled

---

## Tech Stack

- **Electron 33** — native macOS app shell
- **React 18 + TypeScript** — frontend UI
- **Vite** — fast frontend build tool
- **Express** — embedded local API server
- **Tailwind CSS** — blueprint-themed styling
- **Recharts** — interactive charts
- **xlsx** — Excel export
- **poppler** — PDF to image rendering
