const { app, BrowserWindow, ipcMain, safeStorage } = require('electron')
const path = require('node:path')
const { openLocalDatabase } = require('./database.cjs')
const isDev = !app.isPackaged
let localDb

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

function registerDatabaseHandlers() {
  ipcMain.handle('db:summary', () => localDb.getSummary())
  ipcMain.handle('db:company:current', () => localDb.getCurrentCompany())
  ipcMain.handle('db:companies:list', () => localDb.listCompanies())
  ipcMain.handle('db:companies:create', (_event, input) => localDb.createCompany(input))
  ipcMain.handle('db:company:set-active', (_event, id) => localDb.setActiveCompany(id))
  ipcMain.handle('db:company:gstins:list', (_event, id) => localDb.listCompanyGstins(id))
  ipcMain.handle('db:company:gstins:add', (_event, input) => localDb.addCompanyGstin(input))
  ipcMain.handle('db:customers:list', (_event, limit) => localDb.listCustomers(limit))
  ipcMain.handle('db:customers:create', (_event, input) => localDb.createCustomer(input))
  ipcMain.handle('db:products:list', (_event, limit) => localDb.listProducts(limit))
  ipcMain.handle('db:products:create', (_event, input) => localDb.createProduct(input))
}

app.whenReady().then(async () => {
  const databasePath = path.join(app.getPath('userData'), 'data', 'bizora.sqlite')
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable; BIZORA will not save business data without encryption.')
  const encryption = {
    encrypt: data => safeStorage.encryptString(data.toString('base64')),
    decrypt: data => Buffer.from(safeStorage.decryptString(data), 'base64')
  }
  localDb = await openLocalDatabase(databasePath, encryption)
  ipcMain.handle('app:get-version', () => app.getVersion())
  registerDatabaseHandlers()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
}).catch(error => {
  console.error('BIZORA startup failed:', error)
  app.quit()
})

app.on('before-quit', () => { if (localDb) localDb.close() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
