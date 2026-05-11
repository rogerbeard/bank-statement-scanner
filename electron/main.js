const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

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

// ─── Server ───────────────────────────────────────────────────────────────────

let serverProcess = null
const SERVER_PORT = 47291 // Unlikely-to-conflict port

function getServerPath() {
  if (isDev) return path.join(appRoot, 'server', 'index.js')
  // In production, server is bundled in resources
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
    })

    serverProcess.stdout.on('data', d => console.log('[Server]', d.toString().trim()))
    serverProcess.stderr.on('data', d => console.error('[Server ERR]', d.toString().trim()))
    serverProcess.on('error', reject)

    // Poll until server is ready
    const start = Date.now()
    const poll = setInterval(() => {
      http.get(`http://localhost:${SERVER_PORT}/api/settings`, res => {
        if (res.statusCode === 200) {
          clearInterval(poll)
          resolve()
        }
      }).on('error', () => {
        if (Date.now() - start > 15000) {
          clearInterval(poll)
          reject(new Error('Server failed to start within 15s'))
        }
      })
    }, 300)
  })
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow = null

function createWindow() {
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
ipcMain.handle('get-user-data-path', () => userDataDir)
ipcMain.handle('open-data-folder', () => shell.openPath(userDataDir))

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
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
    splash.close()
    createWindow()
  } catch (err) {
    splash.close()
    dialog.showErrorBox(
      'Bank Statement Scanner — Startup Error',
      `Failed to start the server:\n\n${err.message}\n\nPlease reinstall the application.`
    )
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopServer()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', stopServer)

// Security: prevent new window creation
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
