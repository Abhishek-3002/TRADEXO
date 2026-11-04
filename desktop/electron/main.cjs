const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { createSyncEngine } = require('./sync-engine.cjs')
const isDev = !app.isPackaged
const syncEngine = createSyncEngine(app)

function assertTrustedSender(event) {
  const senderUrl = event.senderFrame && event.senderFrame.url
  const trusted = isDev
    ? typeof senderUrl === 'string' && senderUrl.startsWith('http://127.0.0.1:5173/')
    : typeof senderUrl === 'string' && senderUrl.startsWith('file://')
  if (!trusted) throw new Error('Untrusted renderer blocked.')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1000, minHeight: 680,
    backgroundColor: '#f8f8fc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  if (isDev) win.loadURL('http://127.0.0.1:5173')
  else win.loadFile(path.join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('sync:enqueue', (event, item) => {
    assertTrustedSender(event)
    return syncEngine.enqueue(item)
  })
  ipcMain.handle('sync:pending-count', (event) => {
    assertTrustedSender(event)
    return syncEngine.pendingCount()
  })
  ipcMain.handle('sync:push-pending', (event, context) => {
    assertTrustedSender(event)
    return syncEngine.pushPending(context)
  })
  ipcMain.handle('sync:pull-events', (event, context, limit) => {
    assertTrustedSender(event)
    return syncEngine.pullEvents(context, limit)
  })
  ipcMain.handle('sync:acknowledge-pulled', (event, context, cursor) => {
    assertTrustedSender(event)
    return syncEngine.acknowledgePulled(context, cursor)
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
