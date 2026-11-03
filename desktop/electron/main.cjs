const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require('electron')
const fs = require('node:fs')
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
  ipcMain.handle('db:company:profile:update', (_event, input) => localDb.updateCompanyProfile(input))
  ipcMain.handle('db:company:set-active', (_event, id) => localDb.setActiveCompany(id))
  ipcMain.handle('db:company:gstins:list', (_event, id) => localDb.listCompanyGstins(id))
  ipcMain.handle('db:company:gstins:add', (_event, input) => localDb.addCompanyGstin(input))
  ipcMain.handle('db:financial-years:list', () => localDb.listFinancialYears())
  ipcMain.handle('db:financial-years:create', (_event, input) => localDb.createFinancialYear(input))
  ipcMain.handle('db:financial-years:set-active', (_event, id) => localDb.setActiveFinancialYear(id))
  ipcMain.handle('db:company:tax-settings:get', () => localDb.getCompanyTaxSettings())
  ipcMain.handle('db:company:tax-settings:save', (_event, input) => localDb.saveCompanyTaxSettings(input))
  ipcMain.handle('db:customers:list', (_event, limit) => localDb.listCustomers(limit))
  ipcMain.handle('db:customers:create', (_event, input) => localDb.createCustomer(input))
  ipcMain.handle('db:products:list', (_event, limit) => localDb.listProducts(limit))
  ipcMain.handle('db:products:create', (_event, input) => localDb.createProduct(input))
  ipcMain.handle('db:vendors:list', (_event, limit) => localDb.listVendors(limit))
  ipcMain.handle('db:vendors:create', (_event, input) => localDb.createVendor(input))
  ipcMain.handle('db:invoices:list', (_event, limit) => localDb.listSalesInvoices(limit))
  ipcMain.handle('db:receipts:list', (_event, invoiceId, limit) => localDb.listSalesReceipts(invoiceId, limit))
  ipcMain.handle('db:receipts:create', (_event, input) => localDb.recordSalesReceipt(input))
  ipcMain.handle('db:invoices:create-draft', (_event, input) => localDb.createSalesInvoiceDraft(input))
  ipcMain.handle('db:invoices:get', (_event, id) => localDb.getSalesInvoice(id))
  ipcMain.handle('db:invoices:post', (_event, id) => localDb.postSalesInvoice(id))
  ipcMain.handle('db:invoices:reverse', (_event, id, reason) => localDb.reverseSalesInvoice(id, reason))
  ipcMain.handle('db:purchases:list', (_event, limit) => localDb.listPurchaseBills(limit))
  ipcMain.handle('db:purchases:payments:list', (_event, billId, limit) => localDb.listPurchasePayments(billId, limit))
  ipcMain.handle('db:reports:payables-aging', (_event, asOfDate) => localDb.getPayablesAging(asOfDate))
  ipcMain.handle('db:financial-entries:list', (_event, entryType, limit) => localDb.listFinancialEntries(entryType, limit))
  ipcMain.handle('db:financial-entries:summary', () => localDb.getFinancialEntrySummary())
  ipcMain.handle('db:financial-entries:create', (_event, input) => localDb.createFinancialEntry(input))
  ipcMain.handle('db:purchases:payments:create', (_event, input) => localDb.recordPurchasePayment(input))
  ipcMain.handle('db:purchases:create-draft', (_event, input) => localDb.createPurchaseBillDraft(input))
  ipcMain.handle('db:purchases:get', (_event, id) => localDb.getPurchaseBill(id))
  ipcMain.handle('db:purchases:post', (_event, id) => localDb.postPurchaseBill(id))
  ipcMain.handle('db:purchases:reverse', (_event, id, reason) => localDb.reversePurchaseBill(id, reason))
  ipcMain.handle('db:stock:movements', (_event, productId, limit) => localDb.listStockMovements(productId, limit))
  ipcMain.handle('db:stock:product', (_event, productId) => localDb.getProductStock(productId))
  ipcMain.handle('db:stock:adjust', (_event, input) => localDb.createStockAdjustment(input))
  ipcMain.handle('db:stock:low', (_event, limit) => localDb.listLowStockProducts(limit))
  ipcMain.handle('db:backup:create', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win, {
      title: 'Save encrypted BIZORA backup',
      defaultPath: path.join(app.getPath('documents'), 'BIZORA-backup-' + new Date().toISOString().slice(0, 10) + '.bizora-backup'),
      filters: [{ name: 'BIZORA encrypted backup', extensions: ['bizora-backup'] }]
    })
    if (result.canceled || !result.filePath) return { cancelled: true }
    const data = localDb.createEncryptedBackup()
    const temporary = result.filePath + '.tmp'
    fs.writeFileSync(temporary, data, { flag: 'w', mode: 0o600 })
    fs.renameSync(temporary, result.filePath)
    return { cancelled: false, filePath: result.filePath }
  })
  ipcMain.handle('db:backup:restore', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const selected = await dialog.showOpenDialog(win, {
      title: 'Choose a BIZORA encrypted backup',
      properties: ['openFile'],
      filters: [{ name: 'BIZORA encrypted backup', extensions: ['bizora-backup'] }]
    })
    if (selected.canceled || !selected.filePaths?.[0]) return { cancelled: true }
    const confirmation = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Restore backup'],
      defaultId: 0,
      cancelId: 0,
      title: 'Replace current BIZORA data?',
      message: 'Restoring replaces the current local database with the selected backup. Export a fresh backup first if you need the current data.'
    })
    if (confirmation.response !== 1) return { cancelled: true }
    const data = fs.readFileSync(selected.filePaths[0])
    const result = localDb.restoreEncryptedBackup(data)
    return { cancelled: false, ...result }
  })
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
