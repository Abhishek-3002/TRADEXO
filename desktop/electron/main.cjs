const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
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

function handleAppIpc(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    const frame = event.senderFrame
    if (!frame || frame !== event.sender.mainFrame) {
      throw new Error('Blocked IPC request from an untrusted frame.')
    }

    let senderUrl
    try {
      senderUrl = new URL(frame.url)
    } catch {
      throw new Error('Blocked IPC request from an invalid application origin.')
    }

    const trustedOrigin = isDev
      ? senderUrl.protocol === 'http:' && senderUrl.hostname === '127.0.0.1' && senderUrl.port === '5173'
      : senderUrl.protocol === 'file:' && senderUrl.href === pathToFileURL(path.join(__dirname, '../dist/index.html')).href

    if (!trustedOrigin) {
      throw new Error('Blocked IPC request from an untrusted application origin.')
    }

    return handler(event, ...args)
  })
}

function registerDatabaseHandlers() {
  handleAppIpc('db:summary', () => localDb.getSummary())
  handleAppIpc('db:company:current', () => localDb.getCurrentCompany())
  handleAppIpc('db:companies:list', () => localDb.listCompanies())
  handleAppIpc('db:companies:create', (_event, input) => localDb.createCompany(input))
  handleAppIpc('db:company:profile:update', (_event, input) => localDb.updateCompanyProfile(input))
  handleAppIpc('db:company:set-active', (_event, id) => localDb.setActiveCompany(id))
  handleAppIpc('db:company:gstins:list', (_event, id) => localDb.listCompanyGstins(id))
  handleAppIpc('db:company:gstins:add', (_event, input) => localDb.addCompanyGstin(input))
  handleAppIpc('db:financial-years:list', () => localDb.listFinancialYears())
  handleAppIpc('db:financial-years:create', (_event, input) => localDb.createFinancialYear(input))
  handleAppIpc('db:financial-years:set-active', (_event, id) => localDb.setActiveFinancialYear(id))
  handleAppIpc('db:company:tax-settings:get', () => localDb.getCompanyTaxSettings())
  handleAppIpc('db:company:tax-settings:save', (_event, input) => localDb.saveCompanyTaxSettings(input))
  handleAppIpc('db:customers:list', (_event, limit) => localDb.listCustomers(limit))
  handleAppIpc('db:customers:create', (_event, input) => localDb.createCustomer(input))
  handleAppIpc('db:products:list', (_event, limit) => localDb.listProducts(limit))
  handleAppIpc('db:products:create', (_event, input) => localDb.createProduct(input))
  handleAppIpc('db:vendors:list', (_event, limit) => localDb.listVendors(limit))
  handleAppIpc('db:vendors:create', (_event, input) => localDb.createVendor(input))
  handleAppIpc('db:invoices:list', (_event, limit) => localDb.listSalesInvoices(limit))
  handleAppIpc('db:receipts:list', (_event, invoiceId, limit) => localDb.listSalesReceipts(invoiceId, limit))
  handleAppIpc('db:receipts:create', (_event, input) => localDb.recordSalesReceipt(input))
  handleAppIpc('db:invoices:create-draft', (_event, input) => localDb.createSalesInvoiceDraft(input))
  handleAppIpc('db:invoices:get', (_event, id) => localDb.getSalesInvoice(id))
  handleAppIpc('db:invoices:post', (_event, id) => localDb.postSalesInvoice(id))
  handleAppIpc('db:invoices:reverse', (_event, id, reason) => localDb.reverseSalesInvoice(id, reason))
  handleAppIpc('db:purchases:list', (_event, limit) => localDb.listPurchaseBills(limit))
  handleAppIpc('db:purchases:payments:list', (_event, billId, limit) => localDb.listPurchasePayments(billId, limit))
  handleAppIpc('db:reports:payables-aging', (_event, asOfDate) => localDb.getPayablesAging(asOfDate))
  handleAppIpc('db:financial-entries:list', (_event, entryType, limit) => localDb.listFinancialEntries(entryType, limit))
  handleAppIpc('db:financial-entries:summary', () => localDb.getFinancialEntrySummary())
  handleAppIpc('db:financial-entries:create', (_event, input) => localDb.createFinancialEntry(input))
  handleAppIpc('db:purchases:payments:create', (_event, input) => localDb.recordPurchasePayment(input))
  handleAppIpc('db:purchases:create-draft', (_event, input) => localDb.createPurchaseBillDraft(input))
  handleAppIpc('db:purchases:get', (_event, id) => localDb.getPurchaseBill(id))
  handleAppIpc('db:purchases:post', (_event, id) => localDb.postPurchaseBill(id))
  handleAppIpc('db:purchases:reverse', (_event, id, reason) => localDb.reversePurchaseBill(id, reason))
  handleAppIpc('db:stock:movements', (_event, productId, limit) => localDb.listStockMovements(productId, limit))
  handleAppIpc('db:stock:product', (_event, productId) => localDb.getProductStock(productId))
  handleAppIpc('db:stock:adjust', (_event, input) => localDb.createStockAdjustment(input))
  handleAppIpc('db:stock:low', (_event, limit) => localDb.listLowStockProducts(limit))
  handleAppIpc('db:backup:create', async () => {
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
  handleAppIpc('db:backup:restore', async () => {
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
  handleAppIpc('app:get-version', () => app.getVersion())
  registerDatabaseHandlers()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
}).catch(error => {
  console.error('BIZORA startup failed:', error)
  app.quit()
})

app.on('before-quit', () => { if (localDb) localDb.close() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
