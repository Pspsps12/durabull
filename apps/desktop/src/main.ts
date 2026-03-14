import { randomBytes } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, safeStorage, shell } from 'electron'

const APP_HOST = '127.0.0.1'
const SERVER_BOOT_TIMEOUT_MS = 30_000
const SECRET_FILE_NAME = 'local-secret.json'
const SECRET_KEY_BYTES = 32

let mainWindow: BrowserWindow | null = null
let apiProcess: ChildProcessWithoutNullStreams | null = null
let runtimeUrl = ''
let isQuitting = false

interface PersistedSecret {
  mode: 'plain' | 'safeStorage'
  value: string
}

function getResourceRoot(): string {
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'dist')
}

function getBundleRoot(): string {
  return join(getResourceRoot(), 'app-bundle')
}

function getBunPath(): string {
  const executableName = process.platform === 'win32' ? 'bun.exe' : 'bun'
  return join(getResourceRoot(), 'bin', executableName)
}

async function ensureLocalSecret(): Promise<string> {
  const secretDir = join(app.getPath('userData'), 'secrets')
  const secretPath = join(secretDir, SECRET_FILE_NAME)

  await mkdir(secretDir, { recursive: true })

  if (existsSync(secretPath)) {
    const fileContents = await readFile(secretPath, 'utf8')
    const persisted = JSON.parse(fileContents) as PersistedSecret

    if (persisted.mode === 'safeStorage') {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error(
          'Saved local credentials are protected with OS secure storage, but secure storage is unavailable right now.'
        )
      }

      return safeStorage.decryptString(Buffer.from(persisted.value, 'base64'))
    }

    return persisted.value
  }

  const secret = randomBytes(SECRET_KEY_BYTES).toString('hex')
  const persisted: PersistedSecret = safeStorage.isEncryptionAvailable()
    ? {
        mode: 'safeStorage',
        value: safeStorage.encryptString(secret).toString('base64'),
      }
    : {
        mode: 'plain',
        value: secret,
      }

  await writeFile(secretPath, JSON.stringify(persisted, null, 2), 'utf8')
  return secret
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, APP_HOST, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to allocate a local port for the desktop API server.'))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(port)
      })
    })
  })
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS

  while (Date.now() < deadline) {
    const currentProcess = apiProcess
    if (currentProcess && currentProcess.exitCode !== null) {
      throw new Error(`Local API exited before startup completed (code ${currentProcess.exitCode}).`)
    }

    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return
    } catch {
      // Ignore transient boot failures while the local Bun server starts.
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for the local API server at ${url}.`)
}

function buildServerEnvironment(baseUrl: string, port: number, localSecret: string): NodeJS.ProcessEnv {
  const env = { ...process.env }

  delete env.DATABASE_URL
  delete env.REDIS_URL
  delete env.RESEND_API_KEY

  for (const key of Object.keys(env)) {
    if (key.startsWith('DURABULL_REDIS_URL_')) {
      delete env[key]
    }
  }

  env.NODE_ENV = 'production'
  env.APP_BASE_URL = baseUrl
  env.VITE_PUBLIC_APP_URL = baseUrl
  env.PORT = String(port)
  env.DURABULL_AUTHLESS = 'true'
  env.DURABULL_ENV_CONNECTIONS = 'false'
  env.DURABULL_PGLITE_DIR = join(app.getPath('userData'), 'pglite')
  env.BETTER_AUTH_SECRET = localSecret
  env.DURABULL_REDIS_URL_ENCRYPTION_KEY = localSecret

  return env
}

async function startLocalRuntime(): Promise<string> {
  const bundleRoot = getBundleRoot()
  const bunPath = getBunPath()
  const entryPoint = join(bundleRoot, 'apps', 'api', 'dist', 'index.js')

  if (!existsSync(bunPath)) {
    throw new Error(`Bundled Bun runtime not found at ${bunPath}. Run the desktop build first.`)
  }

  if (!existsSync(entryPoint)) {
    throw new Error(`Bundled API entry point not found at ${entryPoint}. Run the desktop build first.`)
  }

  const port = await getAvailablePort()
  const baseUrl = `http://${APP_HOST}:${port}`
  const localSecret = await ensureLocalSecret()

  await mkdir(join(app.getPath('userData'), 'pglite'), { recursive: true })

  apiProcess = spawn(bunPath, [entryPoint], {
    cwd: bundleRoot,
    env: buildServerEnvironment(baseUrl, port, localSecret),
    stdio: 'pipe',
  })

  apiProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[durabull-api] ${String(chunk)}`)
  })

  apiProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[durabull-api] ${String(chunk)}`)
  })

  apiProcess.once('exit', (code) => {
    if (isQuitting) return

    const detail = code === null ? 'The local API process exited unexpectedly.' : `Exit code: ${code}`
    dialog.showErrorBox('Durabull stopped running', detail)
    app.quit()
  })

  await waitForServer(baseUrl)
  runtimeUrl = baseUrl
  return baseUrl
}

function stopLocalRuntime(): void {
  if (!apiProcess || apiProcess.killed) return

  if (process.platform === 'win32') {
    if (apiProcess.pid) {
      spawn('taskkill', ['/pid', String(apiProcess.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    }
  } else {
    apiProcess.kill('SIGTERM')
  }
}

function createMainWindow(baseUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#0b0e14',
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  const allowNavigation = (targetUrl: string) => targetUrl.startsWith(baseUrl)

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (allowNavigation(url)) {
      return { action: 'allow' }
    }

    void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (allowNavigation(url)) return

    event.preventDefault()
    void shell.openExternal(url)
  })

  void window.loadURL(baseUrl)
  return window
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady()
    .then(async () => {
      const baseUrl = await startLocalRuntime()
      mainWindow = createMainWindow(baseUrl)
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      dialog.showErrorBox('Unable to start Durabull', message)
      app.quit()
    })
}

app.on('activate', () => {
  if (mainWindow || !runtimeUrl) return
  mainWindow = createMainWindow(runtimeUrl)
})

app.on('browser-window-created', (_event, window) => {
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  stopLocalRuntime()
})
