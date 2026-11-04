const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const crypto = require('node:crypto')
const { hashPin, verifyPin, isValidPin, createRecoveryCode, hashRecoveryCode, verifyRecoveryCode } = require('./security.cjs')
const { openLocalDatabase } = require('./database.cjs')
const isDev = !app.isPackaged
let localDb
let pinMetadata = null
let unlocked = false
let failedPinAttempts = 0
let blockedUntil = 0
let idleLockTimer = null
const IDLE_LOCK_MS = 5 * 60 * 1000
const PIN_FILE = () => path.join(app.getPath('userData'), 'security.dat')

function savePinMetadata(metadata) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable. BIZORA cannot safely save PIN settings on this device.')
  const encrypted = safeStorage.encryptString(JSON.stringify(metadata))
  const temporary = PIN_FILE() + '.tmp'
  fs.writeFileSync(temporary, encrypted, { flag: 'w', mode: 0o600 })
  fs.renameSync(temporary, PIN_FILE())
  pinMetadata = metadata
}

function loadPinMetadata() {
  if (!fs.existsSync(PIN_FILE())) return null
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable. BIZORA cannot safely read PIN settings on this device.')
  const parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(PIN_FILE())))
  if (!parsed || parsed.version !== 1 || typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string') throw new Error('BIZORA security settings are damaged. Contact support.')
  return parsed
}

function lockApplication() {
  const wasUnlocked = unlocked
  unlocked = false
  if (idleLockTimer) clearTimeout(idleLockTimer)
  idleLockTimer = null
  if (wasUnlocked) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('security:locked')
    }
  }
}

function resetIdleLock() {
  if (!unlocked) return
  if (idleLockTimer) clearTimeout(idleLockTimer)
  idleLockTimer = setTimeout(lockApplication, IDLE_LOCK_MS)
  idleLockTimer.unref?.()
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
  const trustedRendererUrl = isDev
    ? 'http://127.0.0.1:5173/'
    : pathToFileURL(path.join(__dirname, '../dist/index.html')).href
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== trustedRendererUrl) event.preventDefault()
  })
  win.webContents.on('will-attach-webview', event => event.preventDefault())
  win.on('minimize', () => lockApplication())
  if (isDev) win.loadURL('http://127.0.0.1:5173')
  else win.loadFile(path.join(__dirname, '../dist/index.html'))
}

function handleAppIpc(channel, handler, { requiresUnlock = true } = {}) {
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

    if (requiresUnlock && !unlocked) throw new Error('BIZORA is locked. Unlock with your PIN to continue.')
    if (requiresUnlock) resetIdleLock()
    return handler(event, ...args)
  })
}

function registerSecurityHandlers() {
  handleAppIpc('security:get-status', () => ({ configured: Boolean(pinMetadata), unlocked }), { requiresUnlock: false })
  handleAppIpc('security:setup-pin', async (_event, pin) => {
    if (pinMetadata) throw new Error('A PIN is already configured.')
    if (!isValidPin(pin)) throw new Error('PIN must contain 6 to 12 digits.')
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = (await hashPin(pin, salt)).toString('hex')
    const recoveryCode = createRecoveryCode()
    const recoverySalt = crypto.randomBytes(16).toString('hex')
    const recoveryHash = hashRecoveryCode(recoveryCode, recoverySalt)
    savePinMetadata({ version: 1, salt, hash, recoverySalt, recoveryHash, failedPinAttempts: 0, blockedUntil: 0 })
    unlocked = true
    failedPinAttempts = 0
    resetIdleLock()
    return { configured: true, unlocked: true, recoveryCode }
  }, { requiresUnlock: false })
  handleAppIpc('security:unlock', async (_event, pin) => {
    if (!pinMetadata) throw new Error('Set up your BIZORA PIN first.')
    if (Date.now() < blockedUntil) throw new Error('Too many incorrect attempts. Please wait before trying again.')
    if (!isValidPin(pin)) throw new Error('Enter your 6 to 12 digit PIN.')
    const matches = await verifyPin(pin, pinMetadata.salt, pinMetadata.hash)
    if (!matches) {
      failedPinAttempts += 1
      if (failedPinAttempts >= 5) blockedUntil = Date.now() + Math.min(3600000, 30000 * (2 ** (failedPinAttempts - 5)))
      savePinMetadata({ ...pinMetadata, failedPinAttempts, blockedUntil })
      throw new Error(failedPinAttempts >= 5 ? 'Incorrect PIN. Too many attempts; try again later.' : 'Incorrect PIN.')
    }
    failedPinAttempts = 0
    blockedUntil = 0
    savePinMetadata({ ...pinMetadata, failedPinAttempts: 0, blockedUntil: 0 })
    unlocked = true
    resetIdleLock()
    return { configured: true, unlocked: true }
  }, { requiresUnlock: false })
  handleAppIpc('security:recover-pin', async (_event, recoveryCode, newPin) => {
    if (!pinMetadata || !pinMetadata.recoverySalt || !pinMetadata.recoveryHash) throw new Error('No recovery code is configured for this installation.')
    if (Date.now() < blockedUntil) throw new Error('Too many incorrect attempts. Please wait before trying again.')
    if (!isValidPin(newPin)) throw new Error('New PIN must contain 6 to 12 digits.')
    if (!verifyRecoveryCode(recoveryCode, pinMetadata.recoverySalt, pinMetadata.recoveryHash)) {
      failedPinAttempts += 1
      if (failedPinAttempts >= 5) blockedUntil = Date.now() + Math.min(3600000, 30000 * (2 ** (failedPinAttempts - 5)))
      savePinMetadata({ ...pinMetadata, failedPinAttempts, blockedUntil })
      throw new Error(failedPinAttempts >= 5 ? 'Incorrect recovery code. Too many attempts; try again later.' : 'Recovery code is incorrect.')
    }
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = (await hashPin(newPin, salt)).toString('hex')
    const nextRecoveryCode = createRecoveryCode()
    const recoverySalt = crypto.randomBytes(16).toString('hex')
    const recoveryHash = hashRecoveryCode(nextRecoveryCode, recoverySalt)
    savePinMetadata({ version: 1, salt, hash, recoverySalt, recoveryHash, failedPinAttempts: 0, blockedUntil: 0 })
    failedPinAttempts = 0
    blockedUntil = 0
    unlocked = true
    resetIdleLock()
    return { configured: true, unlocked: true, recoveryCode: nextRecoveryCode }
  }, { requiresUnlock: false })
  handleAppIpc('security:change-pin', async (_event, currentPin, newPin) => {
    if (!pinMetadata || !unlocked) throw new Error('Unlock BIZORA before changing your PIN.')
    if (!isValidPin(currentPin)) throw new Error('Enter your current 6–12 digit PIN.')
    if (!isValidPin(newPin)) throw new Error('New PIN must contain 6 to 12 digits.')
    const currentMatches = await verifyPin(currentPin, pinMetadata.salt, pinMetadata.hash)
    if (!currentMatches) {
      failedPinAttempts += 1
      if (failedPinAttempts >= 5) blockedUntil = Date.now() + Math.min(3600000, 30000 * (2 ** (failedPinAttempts - 5)))
      savePinMetadata({ ...pinMetadata, failedPinAttempts, blockedUntil })
      if (failedPinAttempts >= 5) lockApplication()
      throw new Error('Current PIN is incorrect.')
    }
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = (await hashPin(newPin, salt)).toString('hex')
    savePinMetadata({ version: 1, salt, hash, failedPinAttempts: 0, blockedUntil: 0 })
    failedPinAttempts = 0
    blockedUntil = 0
    resetIdleLock()
    return { changed: true }
  })
  handleAppIpc('security:lock', () => { lockApplication(); return { unlocked: false } }, { requiresUnlock: false })

  handleAppIpc('security:activity', () => { resetIdleLock(); return { ok: true } }, { requiresUnlock: false })
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
    const backupPath = selected.filePaths[0]
    const backupStats = fs.statSync(backupPath)
    const maxBackupBytes = 500 * 1024 * 1024
    if (!backupStats.isFile()) throw new Error('Selected backup must be a regular file.')
    if (backupStats.size > maxBackupBytes) throw new Error('Backup file exceeds the 500 MB safety limit.')
    if (backupStats.size === 0) throw new Error('Selected backup file is empty.')
    const data = fs.readFileSync(backupPath)
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
  pinMetadata = loadPinMetadata()
  failedPinAttempts = Number.isInteger(pinMetadata?.failedPinAttempts) ? pinMetadata.failedPinAttempts : 0
  blockedUntil = Number.isFinite(pinMetadata?.blockedUntil) ? pinMetadata.blockedUntil : 0
  unlocked = false
  handleAppIpc('app:get-version', () => app.getVersion(), { requiresUnlock: false })
  registerSecurityHandlers()
  registerDatabaseHandlers()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
}).catch(error => {
  console.error('BIZORA startup failed:', error)
  app.quit()
})

app.on('before-quit', () => { if (localDb) localDb.close() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
