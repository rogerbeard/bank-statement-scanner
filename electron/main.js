const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

// ─── Single-instance lock ─────────────────────────────────────────────────────
// Prevents infinite instance spawning — if another instance is already running,
// focus it and quit this new one immediately.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running — quit silently
  app.quit()
  process.exit(0)
}

// When a second instance tries to launch, bring the existing window to front
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// ─── Paths ────────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const appRoot = isDev ? path.join(__dirname, '..') : path.dirname(app.getAppPath())

// User data directory (persists across updates)
const userDataDir = app.getPath('userData')
const uploadsDir = path.join(userDataDir, 'uploads')
const dataDir = path.join(userDataDir, 'data')

for (const dir of [uploadsDir, dataDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── Crash / loop guard ───────────────────────────────────────────────────────
// Write a launch timestamp; if the app crashes on startup repeatedly,
// this prevents an infinite relaunch loop.
const lockFile = path.join(dataDir, '.launch_lock')
const MAX_CRASH_COUNT = 3
const CRASH_WINDOW_MS = 10000 // 10 seconds

function checkLaunchSafety() {
  try {
    let record = { count: 0, firstLaunch: Date.now() }
    if (fs.existsSync(lockFile)) {
      try { record = JSON.parse(fs.readFileSync(lockFile, 'utf8')) } catch {}
    }
    const now = Date.now()
    if (now - record.firstLaunch > CRASH_WINDOW_MS) {
      // Reset window
      record = { count: 1, firstLaunch: now }
    } else {
      record.count++
    }
    fs.writeFileSync(lockFile, JSON.stringify(record))
    if (record.count > MAX_CRASH_COUNT) {
      dialog.showErrorBox(
        'Bank Statement Scanner — Startup Loop Detected',
        'The app has crashed on startup multiple times.\n\n' +
        'Please try reinstalling the application.\n\n' +
        'If the problem persists, delete the app data folder:\n' +
        userDataDir
      )
      app.quit()
      return false
    }
    return true
  } catch {
    return true // Don't block launch on lock file errors
  }
}

function clearLaunchLock() {
  try { fs.unlinkSync(lockFile) } catch {}
}

// ─── Server ───────────────────────────────────────────────────────────────────

let serverProcess = null
const SERVER_PORT = 47291

function getServerPath() {
  if (isDev) return path.join(appRoot, 'server', 'index.js')
  return path.join(process.resourcesPath, 'app', 'server', 'index.js')
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getServerPath()

    // Find pdftoppm — check bundled bin first, then system PATH
    let pdftoppmPath = 'pdftoppm'
    const bundledBin = path.join(
      isDev ? path.join(appRoot, 'build-resources', 'bin', 'mac') : process.resourcesPath,
      'bin',
      'pdftoppm'
    )
    if (fs.existsSync(bundledBin)) pdftoppmPath = bundledBin

    const env = {
      ...process.env,
      PORT: String(SERVER_PORT),
      BSS_UPLOADS_DIR: uploadsDir,
      BSS_DATA_DIR: dataDir,
      BSS_PDFTOPPM: pdftoppmPath,
      NODE_ENV: isDev ? 'development' : 'production',
    }

    serverProcess = spawn(process.execPath, [serverPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    serverProcess.stdout.on('data', d => console.log('[Server]', d.toString().trim()))
    serverProcess.stderr.on('data', d => console.error('[Server ERR]', d.toString().trim()))
    serverProcess.on('error', reject)

    // Poll until server is ready (max 20s)
    const start = Date.now()
    const poll = setInterval(() => {
      http.get(`http://localhost:${SERVER_PORT}/api/settings`, res => {
        if (res.statusCode === 200) {
          clearInterval(poll)
          resolve()
        }
      }).on('error', () => {
        if (Date.now() - start > 20000) {
          clearInterval(poll)
          reject(new Error('Server failed to start within 20s'))
        }
      })
    }, 400)
  })
}

function stopServer() {
  if (serverProcess) {
    try { serverProcess.kill('SIGTERM') } catch {}
    serverProcess = null
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow = null

function createWindow() {
  // Guard: don't create a second window if one already exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
    return
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a1628',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    icon: path.join(__dirname, '..', 'build-resources', 'icon.png'),
  })

  const url = isDev
    ? 'http://localhost:5173'
    : `http://localhost:${SERVER_PORT}`

  mainWindow.loadURL(url)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools()
    // Clear the crash lock once the window successfully shows
    clearLaunchLock()
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function buildMenu() {
  const template = [
    {
      label: 'Bank Statement Scanner',
      submenu: [
        { label: 'About Bank Statement Scanner', role: 'about' },
        { type: 'separator' },
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(userDataDir),
        },
        { type: 'separator' },
        { label: 'Hide', role: 'hide' },
        { label: 'Hide Others', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('get-app-version', () => app.getVersion())

// Set window title with version
app.on('browser-window-created', (_, win) => {
  win.setTitle(`Bank Statement Scanner v${app.getVersion()}`)
})
ipcMain.handle('get-user-data-path', () => userDataDir)
ipcMain.handle('open-data-folder', () => shell.openPath(userDataDir))

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Safety check — abort if crash loop detected
  if (!checkLaunchSafety()) return

  buildMenu()

  // Show loading splash
  const splash = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: '#0a1628',
    webPreferences: { nodeIntegration: false },
  })
  splash.loadFile(path.join(__dirname, 'splash.html'))

  try {
    await startServer()
    if (!splash.isDestroyed()) splash.close()
    createWindow()
  } catch (err) {
    if (!splash.isDestroyed()) splash.close()
    dialog.showErrorBox(
      'Bank Statement Scanner — Startup Error',
      `Failed to start the embedded server:\n\n${err.message}\n\n` +
      'Make sure poppler is installed:\n  brew install poppler\n\n' +
      'Then relaunch the application.'
    )
    app.quit()
  }

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopServer()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopServer()
  clearLaunchLock()
})

// Security: prevent navigation to external URLs within the app window
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    const localUrl = `http://localhost:${SERVER_PORT}`
    const devUrl = 'http://localhost:5173'
    if (!url.startsWith(localUrl) && !url.startsWith(devUrl)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
})
