const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS company_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  business_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TEXT NOT NULL
);
INSERT OR IGNORE INTO company_profile (id, business_name, currency, created_at)
VALUES (1, 'My Business', 'INR', datetime('now'));
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  legal_name TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS company_gstins (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  gstin TEXT NOT NULL UNIQUE,
  state_code TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS company_gstins_company_idx ON company_gstins(company_id);
CREATE TABLE IF NOT EXISTS financial_years (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  label TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','closed')),
  created_at TEXT NOT NULL,
  UNIQUE(company_id, label),
  CHECK (start_date <= end_date)
);
CREATE INDEX IF NOT EXISTS financial_years_company_idx ON financial_years(company_id, start_date);
CREATE UNIQUE INDEX IF NOT EXISTS financial_years_one_active_per_company ON financial_years(company_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS company_tax_settings (
  company_id TEXT PRIMARY KEY REFERENCES companies(id),
  gst_enabled INTEGER NOT NULL DEFAULT 0 CHECK (gst_enabled IN (0,1)),
  default_tax_mode TEXT NOT NULL DEFAULT 'none' CHECK (default_tax_mode IN ('none','exclusive','inclusive')),
  place_of_supply_state_code TEXT,
  default_gstin_id TEXT REFERENCES company_gstins(id),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  unit TEXT NOT NULL DEFAULT 'pcs',
  selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  opening_stock REAL NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(name);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at);
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', '1');
`

function requiredText(value, label, max = 120) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' is required.')
  const clean = value.trim()
  if (clean.length > max) throw new Error(label + ' must be ' + max + ' characters or fewer.')
  return clean
}
function optionalText(value, label, max = 240) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error(label + ' must be text.')
  const clean = value.trim()
  if (clean.length > max) throw new Error(label + ' must be ' + max + ' characters or fewer.')
  return clean || null
}
function nonNegativeNumber(value, label) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) throw new Error(label + ' must be a valid non-negative number.')
  return number
}
function rows(db, sql, params = []) {
  const statement = db.prepare(sql)
  try {
    statement.bind(params)
    const result = []
    while (statement.step()) result.push(statement.getAsObject())
    return result
  } finally {
    statement.free()
  }
}
function run(db, sql, params = []) {
  const statement = db.prepare(sql)
  try { statement.run(params) } finally { statement.free() }
}

async function openLocalDatabase(filePath = null, encryption = null) {
  const initSqlJs = require('sql.js')
  const wasmDirectory = path.dirname(require.resolve('sql.js'))
  const SQL = await initSqlJs({ locateFile: file => path.join(wasmDirectory, file) })
  let db
  const encryptedPrefix = Buffer.from('BIZORA_DB_ENC_V1\\n')
  if (filePath && fs.existsSync(filePath)) {
    const stored = fs.readFileSync(filePath)
    if (stored.subarray(0, encryptedPrefix.length).equals(encryptedPrefix)) {
      if (!encryption || typeof encryption.decrypt !== 'function') throw new Error('BIZORA database encryption is unavailable; refusing to open encrypted data.')
      db = new SQL.Database(new Uint8Array(encryption.decrypt(stored.subarray(encryptedPrefix.length))))
    } else {
      // One-time compatibility import for the earlier plaintext development database.
      db = new SQL.Database(new Uint8Array(stored))
    }
  } else {
    db = new SQL.Database()
  }
  db.exec(schema)

  // Upgrade existing single-company databases without discarding user records.
  const legacyProfile = rows(db, 'SELECT business_name,currency FROM company_profile WHERE id=1')[0]
  let companies = rows(db, 'SELECT id FROM companies ORDER BY created_at')
  if (!companies.length) {
    const id = randomUUID()
    run(db, 'INSERT INTO companies (id,business_name,currency,created_at) VALUES (?,?,?,?)',
      [id, legacyProfile?.business_name || 'My Business', legacyProfile?.currency || 'INR', new Date().toISOString()])
    companies = [{ id }]
  }
  const customerColumns = rows(db, 'PRAGMA table_info(customers)').map(column => column.name)
  if (!customerColumns.includes('company_id')) db.exec('ALTER TABLE customers ADD COLUMN company_id TEXT REFERENCES companies(id)')
  const productColumns = rows(db, 'PRAGMA table_info(products)').map(column => column.name)
  if (!productColumns.includes('company_id')) db.exec('ALTER TABLE products ADD COLUMN company_id TEXT REFERENCES companies(id)')
  run(db, 'UPDATE customers SET company_id=? WHERE company_id IS NULL', [companies[0].id])
  run(db, 'UPDATE products SET company_id=? WHERE company_id IS NULL', [companies[0].id])
  const activeStored = rows(db, "SELECT value FROM app_meta WHERE key='active_company_id'")[0]?.value
  let activeCompanyId = companies.some(company => company.id === activeStored) ? activeStored : companies[0].id
  run(db, "INSERT OR REPLACE INTO app_meta (key,value) VALUES ('active_company_id',?)", [activeCompanyId])
  const storedSchemaVersion = Number(rows(db, "SELECT value FROM app_meta WHERE key='schema_version'")[0]?.value || 1)
  if (storedSchemaVersion < 3) {
    // Replace the legacy database-wide SKU constraint with company-scoped uniqueness.
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE products_migrating (
        id TEXT PRIMARY KEY,
        company_id TEXT REFERENCES companies(id),
        name TEXT NOT NULL,
        sku TEXT,
        unit TEXT NOT NULL DEFAULT 'pcs',
        selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
        opening_stock REAL NOT NULL DEFAULT 0 CHECK (opening_stock >= 0),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
        created_at TEXT NOT NULL
      );
      INSERT INTO products_migrating (id,company_id,name,sku,unit,selling_price,opening_stock,status,created_at)
        SELECT id,company_id,name,sku,unit,selling_price,opening_stock,status,created_at FROM products;
      DROP TABLE products;
      ALTER TABLE products_migrating RENAME TO products;
      CREATE INDEX products_name_idx ON products(name);
      CREATE UNIQUE INDEX products_company_sku_unique ON products(company_id,sku) WHERE sku IS NOT NULL;
      COMMIT;
    `)
  }
  run(db, "INSERT OR REPLACE INTO app_meta (key,value) VALUES ('schema_version','4')")

  function persist() {
    if (!filePath) return
    if (!encryption || typeof encryption.encrypt !== 'function') throw new Error('BIZORA database encryption is required before saving local data.')
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    const temporaryPath = filePath + '.tmp'
    const encrypted = Buffer.concat([encryptedPrefix, Buffer.from(encryption.encrypt(Buffer.from(db.export())))])
    fs.writeFileSync(temporaryPath, encrypted, { mode: 0o600 })
    fs.renameSync(temporaryPath, filePath)
  }
  if (filePath) persist() // encrypt fresh databases and transparently upgrade older plaintext development files

  function backupSnapshot() {
    if (!encryption || typeof encryption.encrypt !== 'function') throw new Error('Database encryption is unavailable.')
    return Buffer.concat([encryptedPrefix, Buffer.from(encryption.encrypt(Buffer.from(db.export())))])
  }

  function restoreSnapshot(snapshot) {
    if (!Buffer.isBuffer(snapshot) || snapshot.length < encryptedPrefix.length + 32 || snapshot.length > 500 * 1024 * 1024) {
      throw new Error('Backup file is invalid or exceeds the 500 MB limit.')
    }
    if (!snapshot.subarray(0, encryptedPrefix.length).equals(encryptedPrefix)) throw new Error('This is not a supported BIZORA encrypted backup.')
    if (!encryption || typeof encryption.decrypt !== 'function') throw new Error('Database decryption is unavailable.')
    let candidate
    try {
      candidate = new SQL.Database(new Uint8Array(encryption.decrypt(snapshot.subarray(encryptedPrefix.length))))
      const integrity = rows(candidate, 'PRAGMA integrity_check')[0]?.integrity_check
      if (integrity !== 'ok') throw new Error('Backup database integrity check failed.')
      const version = Number(rows(candidate, "SELECT value FROM app_meta WHERE key='schema_version'")[0]?.value || 0)
      if (![3, 4].includes(version)) throw new Error('Backup version is not supported by this BIZORA build.')
      if (version === 3) {
        candidate.exec(`CREATE TABLE IF NOT EXISTS financial_years (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), label TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','closed')), created_at TEXT NOT NULL, UNIQUE(company_id,label), CHECK(start_date<=end_date)); CREATE INDEX IF NOT EXISTS financial_years_company_idx ON financial_years(company_id,start_date); CREATE UNIQUE INDEX IF NOT EXISTS financial_years_one_active_per_company ON financial_years(company_id) WHERE status='active'; CREATE TABLE IF NOT EXISTS company_tax_settings (company_id TEXT PRIMARY KEY REFERENCES companies(id), gst_enabled INTEGER NOT NULL DEFAULT 0 CHECK(gst_enabled IN (0,1)), default_tax_mode TEXT NOT NULL DEFAULT 'none' CHECK(default_tax_mode IN ('none','exclusive','inclusive')), place_of_supply_state_code TEXT, default_gstin_id TEXT REFERENCES company_gstins(id), updated_at TEXT NOT NULL); UPDATE app_meta SET value='4' WHERE key='schema_version';`)
      }
      const selected = rows(candidate, "SELECT value FROM app_meta WHERE key='active_company_id'")[0]?.value
      if (!selected || !rows(candidate, "SELECT id FROM companies WHERE id=? AND status='active'", [selected]).length) {
        throw new Error('Backup has no valid active company.')
      }
      const requiredTables = ['companies','customers','products','company_gstins','financial_years','company_tax_settings','audit_events']
      const actualTables = rows(candidate, "SELECT name FROM sqlite_master WHERE type='table'").map(item => item.name)
      if (!requiredTables.every(name => actualTables.includes(name))) throw new Error('Backup is missing required BIZORA data tables.')
      const previous = db
      const previousActiveCompanyId = activeCompanyId
      db = candidate
      activeCompanyId = selected
      try {
        recordAudit('database.restored', 'database', 'local', {})
        persist()
      } catch (error) {
        db = previous
        activeCompanyId = previousActiveCompanyId
        throw error
      }
      candidate = null
      previous.close()
      return { restored: true, company: rows(db, 'SELECT id,business_name,legal_name,currency,status,created_at FROM companies WHERE id=?', [activeCompanyId])[0] || null }
    } catch (error) {
      if (candidate) candidate.close()
      throw new Error('Backup restore failed: ' + error.message)
    }
  }

  function recordAudit(eventType, entityType, entityId, details) {
    run(db, 'INSERT INTO audit_events (id,event_type,entity_type,entity_id,details_json,created_at) VALUES (?,?,?,?,?,?)',
      [randomUUID(), eventType, entityType, entityId, JSON.stringify(details), new Date().toISOString()])
  }

  return Object.freeze({
    getCurrentCompany() {
      return rows(db, 'SELECT id,business_name,legal_name,currency,status,created_at FROM companies WHERE id=?', [activeCompanyId])[0] || null
    },
    listCompanies() {
      return rows(db, `SELECT c.id,c.business_name,c.legal_name,c.currency,c.status,c.created_at,
        (SELECT COUNT(*) FROM company_gstins g WHERE g.company_id=c.id AND g.status='active') AS gstin_count
        FROM companies c ORDER BY c.created_at`)
    },
    createCompany(input = {}) {
      const company = { id: randomUUID(), business_name: requiredText(input.businessName, 'Business name'),
        legal_name: optionalText(input.legalName, 'Legal name', 180), currency: 'INR', status: 'active',
        created_at: new Date().toISOString() }
      run(db, 'INSERT INTO companies (id,business_name,legal_name,currency,status,created_at) VALUES (?,?,?,?,?,?)',
        [company.id, company.business_name, company.legal_name, company.currency, company.status, company.created_at])
      recordAudit('company.created', 'company', company.id, { business_name: company.business_name })
      persist()
      return company
    },
    setActiveCompany(companyId) {
      const exists = rows(db, "SELECT id FROM companies WHERE id=? AND status='active'", [requiredText(companyId, 'Company ID', 80)])[0]
      if (!exists) throw new Error('Active company was not found.')
      activeCompanyId = exists.id
      run(db, "INSERT OR REPLACE INTO app_meta (key,value) VALUES ('active_company_id',?)", [activeCompanyId])
      recordAudit('company.switched', 'company', activeCompanyId, {})
      persist()
      return this.getCurrentCompany()
    },
    listCompanyGstins(companyId = activeCompanyId) {
      return rows(db, "SELECT id,company_id,gstin,state_code,label,status,created_at FROM company_gstins WHERE company_id=? ORDER BY created_at DESC", [companyId])
    },
    addCompanyGstin(input = {}) {
      const companyId = input.companyId ? requiredText(input.companyId, 'Company ID', 80) : activeCompanyId
      if (!rows(db, 'SELECT id FROM companies WHERE id=?', [companyId]).length) throw new Error('Company was not found.')
      const gstin = requiredText(input.gstin, 'GSTIN', 15).toUpperCase()
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new Error('Enter a valid 15-character GSTIN format.')
      const stateCode = gstin.slice(0, 2)
      const registration = { id: randomUUID(), company_id: companyId, gstin, state_code: stateCode,
        label: optionalText(input.label, 'GSTIN label', 80), status: 'active', created_at: new Date().toISOString() }
      run(db, 'INSERT INTO company_gstins (id,company_id,gstin,state_code,label,status,created_at) VALUES (?,?,?,?,?,?,?)',
        [registration.id, registration.company_id, registration.gstin, registration.state_code, registration.label, registration.status, registration.created_at])
      recordAudit('company.gstin_added', 'company_gstin', registration.id, { company_id: companyId, gstin })
      persist()
      return registration
    },
    listFinancialYears(companyId = activeCompanyId) {
      return rows(db, 'SELECT id,company_id,label,start_date,end_date,status,created_at FROM financial_years WHERE company_id=? ORDER BY start_date DESC', [companyId])
    },
    createFinancialYear(input = {}) {
      const companyId = input.companyId ? requiredText(input.companyId, 'Company ID', 80) : activeCompanyId
      if (!rows(db, "SELECT id FROM companies WHERE id=? AND status='active'", [companyId]).length) throw new Error('Active company was not found.')
      const label = requiredText(input.label, 'Financial year label', 40)
      const startDate = requiredText(input.startDate, 'Start date', 10)
      const endDate = requiredText(input.endDate, 'End date', 10)
      const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value
      if (!validDate(startDate) || !validDate(endDate)) throw new Error('Enter valid dates in YYYY-MM-DD format.')
      if (startDate > endDate) throw new Error('Financial year start date must be on or before its end date.')
      const overlap = rows(db, 'SELECT label FROM financial_years WHERE company_id=? AND NOT(end_date < ? OR start_date > ?) LIMIT 1', [companyId, startDate, endDate])[0]
      if (overlap) throw new Error('This date range overlaps financial year ' + overlap.label + '.')
      const year = { id: randomUUID(), company_id: companyId, label, start_date: startDate, end_date: endDate, status: 'inactive', created_at: new Date().toISOString() }
      run(db, 'INSERT INTO financial_years (id,company_id,label,start_date,end_date,status,created_at) VALUES (?,?,?,?,?,?,?)', [year.id, companyId, label, startDate, endDate, year.status, year.created_at])
      recordAudit('financial_year.created', 'financial_year', year.id, { label, start_date: startDate, end_date: endDate })
      persist()
      return year
    },
    setActiveFinancialYear(yearId) {
      const id = requiredText(yearId, 'Financial year ID', 80)
      const year = rows(db, "SELECT id,company_id FROM financial_years WHERE id=? AND company_id=? AND status!='closed'", [id, activeCompanyId])[0]
      if (!year) throw new Error('Financial year was not found or is closed.')
      run(db, "UPDATE financial_years SET status='inactive' WHERE company_id=? AND status='active'", [activeCompanyId])
      run(db, "UPDATE financial_years SET status='active' WHERE id=? AND company_id=?", [id, activeCompanyId])
      recordAudit('financial_year.activated', 'financial_year', id, {})
      persist()
      return this.listFinancialYears().find(item => item.id === id)
    },
    getCompanyTaxSettings(companyId = activeCompanyId) {
      return rows(db, 'SELECT company_id,gst_enabled,default_tax_mode,place_of_supply_state_code,default_gstin_id,updated_at FROM company_tax_settings WHERE company_id=?', [companyId])[0] || {
        company_id: companyId, gst_enabled: 0, default_tax_mode: 'none', place_of_supply_state_code: null, default_gstin_id: null, updated_at: null
      }
    },
    saveCompanyTaxSettings(input = {}) {
      const gstEnabled = input.gstEnabled === true || input.gstEnabled === 1 ? 1 : 0
      const taxMode = requiredText(input.defaultTaxMode || 'none', 'Tax mode', 20)
      if (!['none','exclusive','inclusive'].includes(taxMode)) throw new Error('Choose none, exclusive or inclusive tax mode.')
      const stateCode = optionalText(input.placeOfSupplyStateCode, 'Place of supply state code', 10)
      if (stateCode && !/^\d{2}$/.test(stateCode)) throw new Error('State code must contain exactly two digits.')
      const gstinId = input.defaultGstinId ? requiredText(input.defaultGstinId, 'Default GSTIN ID', 80) : null
      if (gstEnabled && !gstinId) throw new Error('Select a GSTIN for GST-enabled settings.')
      if (gstinId && !rows(db, "SELECT id FROM company_gstins WHERE id=? AND company_id=? AND status='active'", [gstinId, activeCompanyId]).length) throw new Error('Selected GSTIN does not belong to the active company.')
      if (gstEnabled && taxMode === 'none') throw new Error('Choose inclusive or exclusive tax mode when GST is enabled.')
      const updatedAt = new Date().toISOString()
      run(db, `INSERT INTO company_tax_settings (company_id,gst_enabled,default_tax_mode,place_of_supply_state_code,default_gstin_id,updated_at)
        VALUES (?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET gst_enabled=excluded.gst_enabled,default_tax_mode=excluded.default_tax_mode,place_of_supply_state_code=excluded.place_of_supply_state_code,default_gstin_id=excluded.default_gstin_id,updated_at=excluded.updated_at`,
        [activeCompanyId, gstEnabled, taxMode, stateCode, gstinId, updatedAt])
      recordAudit('company.tax_settings_updated', 'company', activeCompanyId, { gst_enabled: gstEnabled, default_tax_mode: taxMode, place_of_supply_state_code: stateCode })
      persist()
      return this.getCompanyTaxSettings()
    },
    createEncryptedBackup() {
      return backupSnapshot()
    },
    restoreEncryptedBackup(snapshot) {
      return restoreSnapshot(snapshot)
    },
    getSummary() {
      const result = rows(db, `SELECT
        (SELECT COUNT(*) FROM customers WHERE status='active' AND company_id=?) AS customers,
        (SELECT COUNT(*) FROM products WHERE status='active' AND company_id=?) AS products,
        (SELECT COUNT(*) FROM audit_events) AS audit_events`, [activeCompanyId, activeCompanyId])
      return result[0]
    },
    listCustomers(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)))
      return rows(db, 'SELECT id,name,phone,email,address,status,created_at FROM customers WHERE company_id=? ORDER BY created_at DESC LIMIT ?', [activeCompanyId, safeLimit])
    },
    createCustomer(input = {}) {
      const customer = {
        id: randomUUID(),
        company_id: activeCompanyId,
        name: requiredText(input.name, 'Customer name'),
        phone: optionalText(input.phone, 'Phone', 30),
        email: optionalText(input.email, 'Email', 160),
        address: optionalText(input.address, 'Address', 500),
        created_at: new Date().toISOString()
      }
      run(db, 'INSERT INTO customers (id,company_id,name,phone,email,address,created_at) VALUES (?,?,?,?,?,?,?)',
        [customer.id, customer.company_id, customer.name, customer.phone, customer.email, customer.address, customer.created_at])
      recordAudit('customer.created', 'customer', customer.id, { name: customer.name })
      persist()
      return customer
    },
    listProducts(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)))
      return rows(db, 'SELECT id,name,sku,unit,selling_price,opening_stock,status,created_at FROM products WHERE company_id=? ORDER BY created_at DESC LIMIT ?', [activeCompanyId, safeLimit])
    },
    createProduct(input = {}) {
      const product = {
        id: randomUUID(),
        company_id: activeCompanyId,
        name: requiredText(input.name, 'Product name'),
        sku: optionalText(input.sku, 'SKU', 60),
        unit: optionalText(input.unit, 'Unit', 20) || 'pcs',
        selling_price: nonNegativeNumber(input.sellingPrice, 'Selling price'),
        opening_stock: nonNegativeNumber(input.openingStock, 'Opening stock'),
        created_at: new Date().toISOString()
      }
      run(db, 'INSERT INTO products (id,company_id,name,sku,unit,selling_price,opening_stock,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [product.id, product.company_id, product.name, product.sku, product.unit, product.selling_price, product.opening_stock, product.created_at])
      recordAudit('product.created', 'product', product.id, { name: product.name })
      persist()
      return product
    },
    close() { db.close() }
  })
}

module.exports = { openLocalDatabase }
