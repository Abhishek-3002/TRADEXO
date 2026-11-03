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
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vendors_company_idx ON vendors(company_id);
CREATE TABLE IF NOT EXISTS sales_invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  financial_year_id TEXT NOT NULL REFERENCES financial_years(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','reversed')),
  total_amount REAL NOT NULL CHECK(total_amount >= 0),
  notes TEXT,
  created_at TEXT NOT NULL,
  posted_at TEXT,
  UNIQUE(company_id, financial_year_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS sales_invoices_company_date_idx ON sales_invoices(company_id,invoice_date);
CREATE TABLE IF NOT EXISTS sales_invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES sales_invoices(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_price REAL NOT NULL CHECK(unit_price >= 0),
  line_total REAL NOT NULL CHECK(line_total >= 0)
);
CREATE INDEX IF NOT EXISTS sales_invoice_items_invoice_idx ON sales_invoice_items(invoice_id);
CREATE TABLE IF NOT EXISTS purchase_bills (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  financial_year_id TEXT NOT NULL REFERENCES financial_years(id),
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  bill_number TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','reversed')),
  total_amount REAL NOT NULL CHECK(total_amount >= 0),
  notes TEXT,
  created_at TEXT NOT NULL,
  posted_at TEXT,
  UNIQUE(company_id, financial_year_id, bill_number)
);
CREATE INDEX IF NOT EXISTS purchase_bills_company_date_idx ON purchase_bills(company_id,bill_date);
CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES purchase_bills(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
  line_total REAL NOT NULL CHECK(line_total >= 0)
);
CREATE INDEX IF NOT EXISTS purchase_bill_items_bill_idx ON purchase_bill_items(bill_id);
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK(movement_type IN ('sale','purchase','sale_reversal','purchase_reversal')),
  reference_type TEXT NOT NULL CHECK(reference_type IN ('sales_invoice','purchase_bill')),
  reference_id TEXT NOT NULL,
  reference_item_id TEXT NOT NULL,
  quantity_delta REAL NOT NULL CHECK(quantity_delta != 0),
  unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(reference_type, reference_item_id, movement_type)
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(company_id,product_id,created_at);
CREATE TRIGGER IF NOT EXISTS stock_movements_no_update BEFORE UPDATE ON stock_movements BEGIN SELECT RAISE(ABORT,'Stock ledger entries are immutable.'); END;
CREATE TRIGGER IF NOT EXISTS stock_movements_no_delete BEFORE DELETE ON stock_movements BEGIN SELECT RAISE(ABORT,'Stock ledger entries cannot be deleted.'); END;
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
  run(db, "INSERT OR REPLACE INTO app_meta (key,value) VALUES ('schema_version','5')")

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
      candidate.exec('PRAGMA foreign_keys = ON;')
      const integrity = rows(candidate, 'PRAGMA integrity_check')[0]?.integrity_check
      if (integrity !== 'ok') throw new Error('Backup database integrity check failed.')
      const version = Number(rows(candidate, "SELECT value FROM app_meta WHERE key='schema_version'")[0]?.value || 0)
      if (![3, 4, 5].includes(version)) throw new Error('Backup version is not supported by this BIZORA build.')
      if (version === 3) {
        candidate.exec(`CREATE TABLE IF NOT EXISTS financial_years (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), label TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','closed')), created_at TEXT NOT NULL, UNIQUE(company_id,label), CHECK(start_date<=end_date)); CREATE INDEX IF NOT EXISTS financial_years_company_idx ON financial_years(company_id,start_date); CREATE UNIQUE INDEX IF NOT EXISTS financial_years_one_active_per_company ON financial_years(company_id) WHERE status='active'; CREATE TABLE IF NOT EXISTS company_tax_settings (company_id TEXT PRIMARY KEY REFERENCES companies(id), gst_enabled INTEGER NOT NULL DEFAULT 0 CHECK(gst_enabled IN (0,1)), default_tax_mode TEXT NOT NULL DEFAULT 'none' CHECK(default_tax_mode IN ('none','exclusive','inclusive')), place_of_supply_state_code TEXT, default_gstin_id TEXT REFERENCES company_gstins(id), updated_at TEXT NOT NULL); UPDATE app_meta SET value='4' WHERE key='schema_version';`)
      }
      if (version < 5) {
        candidate.exec(`CREATE TABLE IF NOT EXISTS vendors (id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,phone TEXT,address TEXT,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS vendors_company_idx ON vendors(company_id);
          CREATE TABLE IF NOT EXISTS sales_invoices (id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),financial_year_id TEXT NOT NULL REFERENCES financial_years(id),customer_id TEXT NOT NULL REFERENCES customers(id),invoice_number TEXT NOT NULL,invoice_date TEXT NOT NULL,due_date TEXT,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','reversed')),total_amount REAL NOT NULL CHECK(total_amount>=0),notes TEXT,created_at TEXT NOT NULL,posted_at TEXT,UNIQUE(company_id,financial_year_id,invoice_number)); CREATE INDEX IF NOT EXISTS sales_invoices_company_date_idx ON sales_invoices(company_id,invoice_date);
          CREATE TABLE IF NOT EXISTS sales_invoice_items (id TEXT PRIMARY KEY,invoice_id TEXT NOT NULL REFERENCES sales_invoices(id),company_id TEXT NOT NULL REFERENCES companies(id),product_id TEXT NOT NULL REFERENCES products(id),description TEXT NOT NULL,quantity REAL NOT NULL CHECK(quantity>0),unit_price REAL NOT NULL CHECK(unit_price>=0),line_total REAL NOT NULL CHECK(line_total>=0)); CREATE INDEX IF NOT EXISTS sales_invoice_items_invoice_idx ON sales_invoice_items(invoice_id);
          CREATE TABLE IF NOT EXISTS purchase_bills (id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),financial_year_id TEXT NOT NULL REFERENCES financial_years(id),vendor_id TEXT NOT NULL REFERENCES vendors(id),bill_number TEXT NOT NULL,bill_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','reversed')),total_amount REAL NOT NULL CHECK(total_amount>=0),notes TEXT,created_at TEXT NOT NULL,posted_at TEXT,UNIQUE(company_id,financial_year_id,bill_number)); CREATE INDEX IF NOT EXISTS purchase_bills_company_date_idx ON purchase_bills(company_id,bill_date);
          CREATE TABLE IF NOT EXISTS purchase_bill_items (id TEXT PRIMARY KEY,bill_id TEXT NOT NULL REFERENCES purchase_bills(id),company_id TEXT NOT NULL REFERENCES companies(id),product_id TEXT NOT NULL REFERENCES products(id),description TEXT NOT NULL,quantity REAL NOT NULL CHECK(quantity>0),unit_cost REAL NOT NULL CHECK(unit_cost>=0),line_total REAL NOT NULL CHECK(line_total>=0)); CREATE INDEX IF NOT EXISTS purchase_bill_items_bill_idx ON purchase_bill_items(bill_id);
          CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),product_id TEXT NOT NULL REFERENCES products(id),movement_type TEXT NOT NULL CHECK(movement_type IN ('sale','purchase','sale_reversal','purchase_reversal')),reference_type TEXT NOT NULL CHECK(reference_type IN ('sales_invoice','purchase_bill')),reference_id TEXT NOT NULL,reference_item_id TEXT NOT NULL,quantity_delta REAL NOT NULL CHECK(quantity_delta!=0),unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost>=0),created_at TEXT NOT NULL,UNIQUE(reference_type,reference_item_id,movement_type)); CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(company_id,product_id,created_at);
          CREATE TRIGGER IF NOT EXISTS stock_movements_no_update BEFORE UPDATE ON stock_movements BEGIN SELECT RAISE(ABORT,'Stock ledger entries are immutable.'); END; CREATE TRIGGER IF NOT EXISTS stock_movements_no_delete BEFORE DELETE ON stock_movements BEGIN SELECT RAISE(ABORT,'Stock ledger entries cannot be deleted.'); END;
          UPDATE app_meta SET value='5' WHERE key='schema_version';`)
      }
      const selected = rows(candidate, "SELECT value FROM app_meta WHERE key='active_company_id'")[0]?.value
      if (!selected || !rows(candidate, "SELECT id FROM companies WHERE id=? AND status='active'", [selected]).length) {
        throw new Error('Backup has no valid active company.')
      }
      const requiredTables = ['companies','customers','products','company_gstins','financial_years','company_tax_settings','vendors','sales_invoices','sales_invoice_items','purchase_bills','purchase_bill_items','stock_movements','audit_events']
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

  function withTransaction(work) {
    const before = db.export()
    db.exec('BEGIN TRANSACTION')
    try {
      const result = work()
      db.exec('COMMIT')
      try { persist() } catch (error) {
        db.close()
        db = new SQL.Database(before)
        throw error
      }
      return result
    } catch (error) {
      try { db.exec('ROLLBACK') } catch {}
      throw error
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
    listVendors(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)))
      return rows(db, "SELECT id,name,phone,address,status,created_at FROM vendors WHERE company_id=? AND status='active' ORDER BY created_at DESC LIMIT ?", [activeCompanyId, safeLimit])
    },
    createVendor(input = {}) {
      const vendor = { id: randomUUID(), company_id: activeCompanyId, name: requiredText(input.name, 'Vendor name'),
        phone: optionalText(input.phone, 'Phone', 30), address: optionalText(input.address, 'Address', 500), created_at: new Date().toISOString() }
      run(db, 'INSERT INTO vendors (id,company_id,name,phone,address,created_at) VALUES (?,?,?,?,?,?)', [vendor.id,vendor.company_id,vendor.name,vendor.phone,vendor.address,vendor.created_at])
      recordAudit('vendor.created', 'vendor', vendor.id, { name: vendor.name })
      persist()
      return vendor
    },
    listSalesInvoices(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)))
      return rows(db, `SELECT i.id,i.invoice_number,i.invoice_date,i.due_date,i.status,i.total_amount,i.created_at,c.name AS customer_name,fy.label AS financial_year
        FROM sales_invoices i JOIN customers c ON c.id=i.customer_id JOIN financial_years fy ON fy.id=i.financial_year_id
        WHERE i.company_id=? ORDER BY i.invoice_date DESC,i.created_at DESC LIMIT ?`, [activeCompanyId,safeLimit])
    },
    createSalesInvoiceDraft(input = {}) {
      const fy = rows(db, "SELECT id,start_date,end_date FROM financial_years WHERE company_id=? AND status='active'", [activeCompanyId])[0]
      if (!fy) throw new Error('Create and activate a financial year before creating invoices.')
      const invoiceDate = requiredText(input.invoiceDate, 'Invoice date', 10)
      if (invoiceDate < fy.start_date || invoiceDate > fy.end_date) throw new Error('Invoice date must fall within the active financial year.')
      const customerId = requiredText(input.customerId, 'Customer', 80)
      if (!rows(db, "SELECT id FROM customers WHERE id=? AND company_id=? AND status='active'", [customerId,activeCompanyId]).length) throw new Error('Select a customer from the active company.')
      const invoiceNumber = requiredText(input.invoiceNumber, 'Invoice number', 50)
      const dueDate = optionalText(input.dueDate, 'Due date', 10)
      if (dueDate && dueDate < invoiceDate) throw new Error('Due date cannot be earlier than invoice date.')
      if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) throw new Error('Add between 1 and 100 invoice items.')
      const items = input.items.map(item => {
        const productId = requiredText(item.productId, 'Product', 80)
        const product = rows(db, "SELECT id,name,unit FROM products WHERE id=? AND company_id=? AND status='active'", [productId,activeCompanyId])[0]
        if (!product) throw new Error('An invoice product does not belong to the active company or is inactive.')
        const quantity = Number(item.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000) throw new Error('Item quantity must be greater than zero.')
        const unitPrice = nonNegativeNumber(item.unitPrice, 'Unit price')
        const description = optionalText(item.description, 'Item description', 180) || product.name
        const lineTotal = Math.round(quantity * unitPrice * 100) / 100
        return { id: randomUUID(), product_id: productId, description, quantity, unit_price: unitPrice, line_total: lineTotal }
      })
      const total = Math.round(items.reduce((sum,item)=>sum+item.line_total,0)*100)/100
      const invoice = { id: randomUUID(), company_id: activeCompanyId, financial_year_id: fy.id, customer_id: customerId,
        invoice_number: invoiceNumber, invoice_date: invoiceDate, due_date: dueDate, status: 'draft', total_amount: total,
        notes: optionalText(input.notes,'Notes',1000), created_at: new Date().toISOString() }
      withTransaction(() => {
        run(db, 'INSERT INTO sales_invoices (id,company_id,financial_year_id,customer_id,invoice_number,invoice_date,due_date,status,total_amount,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [invoice.id,invoice.company_id,invoice.financial_year_id,invoice.customer_id,invoice.invoice_number,invoice.invoice_date,invoice.due_date,invoice.status,invoice.total_amount,invoice.notes,invoice.created_at])
        for (const item of items) run(db, 'INSERT INTO sales_invoice_items (id,invoice_id,company_id,product_id,description,quantity,unit_price,line_total) VALUES (?,?,?,?,?,?,?,?)',
          [item.id,invoice.id,activeCompanyId,item.product_id,item.description,item.quantity,item.unit_price,item.line_total])
        recordAudit('sales_invoice.draft_created','sales_invoice',invoice.id,{invoice_number:invoiceNumber,total_amount:total})
      })
      return invoice
    },
    getSalesInvoice(invoiceId) {
      const invoice = rows(db, `SELECT i.*,c.name AS customer_name,fy.label AS financial_year FROM sales_invoices i
        JOIN customers c ON c.id=i.customer_id JOIN financial_years fy ON fy.id=i.financial_year_id WHERE i.id=? AND i.company_id=?`, [requiredText(invoiceId,'Invoice ID',80),activeCompanyId])[0]
      if (!invoice) return null
      invoice.items = rows(db, 'SELECT id,product_id,description,quantity,unit_price,line_total FROM sales_invoice_items WHERE invoice_id=? AND company_id=?', [invoice.id,activeCompanyId])
      return invoice
    },
    postSalesInvoice(invoiceId) {
      const id = requiredText(invoiceId,'Invoice ID',80)
      return withTransaction(() => {
        const invoice = rows(db, "SELECT * FROM sales_invoices WHERE id=? AND company_id=? AND status='draft'", [id,activeCompanyId])[0]
        if (!invoice) throw new Error('Draft invoice was not found or is already posted.')
        const fy = rows(db, "SELECT id,start_date,end_date FROM financial_years WHERE id=? AND company_id=? AND status='active'", [invoice.financial_year_id,activeCompanyId])[0]
        if (!fy || invoice.invoice_date < fy.start_date || invoice.invoice_date > fy.end_date) throw new Error('The invoice financial year is no longer active. Select the correct financial year before posting.')
        const items = rows(db,'SELECT * FROM sales_invoice_items WHERE invoice_id=? AND company_id=?',[id,activeCompanyId])
        const requiredByProduct = new Map()
        for (const item of items) requiredByProduct.set(item.product_id, (requiredByProduct.get(item.product_id) || 0) + item.quantity)
        for (const [productId, required] of requiredByProduct) {
          const stock = rows(db,'SELECT p.opening_stock + COALESCE(SUM(sm.quantity_delta),0) AS available FROM products p LEFT JOIN stock_movements sm ON sm.product_id=p.id AND sm.company_id=p.company_id WHERE p.id=? AND p.company_id=? GROUP BY p.id',[productId,activeCompanyId])[0]?.available ?? 0
          if (stock < required) throw new Error('Insufficient stock. Available: ' + stock + ', required: ' + required + '.')
        }
        const postedAt = new Date().toISOString()
        for (const item of items) run(db,'INSERT INTO stock_movements (id,company_id,product_id,movement_type,reference_type,reference_id,reference_item_id,quantity_delta,unit_cost,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [randomUUID(),activeCompanyId,item.product_id,'sale','sales_invoice',id,item.id,-item.quantity,0,postedAt])
        run(db,"UPDATE sales_invoices SET status='posted',posted_at=? WHERE id=? AND company_id=?",[postedAt,id,activeCompanyId])
        recordAudit('sales_invoice.posted','sales_invoice',id,{invoice_number:invoice.invoice_number,total_amount:invoice.total_amount,items:items.length})
        return this.getSalesInvoice(id)
      })
    },
    reverseSalesInvoice(invoiceId, reason) {
      const id = requiredText(invoiceId,'Invoice ID',80)
      const note = requiredText(reason,'Reversal reason',300)
      return withTransaction(() => {
        const invoice = rows(db,"SELECT * FROM sales_invoices WHERE id=? AND company_id=? AND status='posted'",[id,activeCompanyId])[0]
        if (!invoice) throw new Error('Only a posted invoice can be reversed.')
        const items = rows(db,'SELECT * FROM sales_invoice_items WHERE invoice_id=? AND company_id=?',[id,activeCompanyId])
        const at = new Date().toISOString()
        for (const item of items) run(db,'INSERT INTO stock_movements (id,company_id,product_id,movement_type,reference_type,reference_id,reference_item_id,quantity_delta,unit_cost,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [randomUUID(),activeCompanyId,item.product_id,'sale_reversal','sales_invoice',id,item.id,item.quantity,0,at])
        run(db,"UPDATE sales_invoices SET status='reversed',notes=COALESCE(notes,'') || ? WHERE id=? AND company_id=?",
          ['\\nReversal: '+note,id,activeCompanyId])
        recordAudit('sales_invoice.reversed','sales_invoice',id,{reason:note})
        return this.getSalesInvoice(id)
      })
    },
    listPurchaseBills(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)))
      return rows(db,`SELECT b.id,b.bill_number,b.bill_date,b.status,b.total_amount,b.created_at,v.name AS vendor_name,fy.label AS financial_year
        FROM purchase_bills b JOIN vendors v ON v.id=b.vendor_id JOIN financial_years fy ON fy.id=b.financial_year_id
        WHERE b.company_id=? ORDER BY b.bill_date DESC,b.created_at DESC LIMIT ?`,[activeCompanyId,safeLimit])
    },
    createPurchaseBillDraft(input = {}) {
      const fy = rows(db,"SELECT id,start_date,end_date FROM financial_years WHERE company_id=? AND status='active'",[activeCompanyId])[0]
      if (!fy) throw new Error('Create and activate a financial year before recording purchases.')
      const billDate = requiredText(input.billDate,'Bill date',10)
      if (billDate < fy.start_date || billDate > fy.end_date) throw new Error('Bill date must fall within the active financial year.')
      const vendorId = requiredText(input.vendorId,'Vendor',80)
      if (!rows(db,"SELECT id FROM vendors WHERE id=? AND company_id=? AND status='active'",[vendorId,activeCompanyId]).length) throw new Error('Select a vendor from the active company.')
      const billNumber = requiredText(input.billNumber,'Supplier bill number',50)
      if (!Array.isArray(input.items) || input.items.length<1 || input.items.length>100) throw new Error('Add between 1 and 100 purchase items.')
      const items=input.items.map(item=>{
        const productId=requiredText(item.productId,'Product',80)
        const product=rows(db,"SELECT id,name FROM products WHERE id=? AND company_id=? AND status='active'",[productId,activeCompanyId])[0]
        if(!product) throw new Error('A purchase product does not belong to the active company or is inactive.')
        const quantity=Number(item.quantity)
        if(!Number.isFinite(quantity)||quantity<=0||quantity>100000000) throw new Error('Item quantity must be greater than zero.')
        const unitCost=nonNegativeNumber(item.unitCost,'Unit cost')
        const description=optionalText(item.description,'Item description',180)||product.name
        return {id:randomUUID(),product_id:productId,description,quantity,unit_cost:unitCost,line_total:Math.round(quantity*unitCost*100)/100}
      })
      const total=Math.round(items.reduce((sum,item)=>sum+item.line_total,0)*100)/100
      const bill={id:randomUUID(),company_id:activeCompanyId,financial_year_id:fy.id,vendor_id:vendorId,bill_number:billNumber,bill_date:billDate,status:'draft',total_amount:total,notes:optionalText(input.notes,'Notes',1000),created_at:new Date().toISOString()}
      withTransaction(()=>{
        run(db,'INSERT INTO purchase_bills (id,company_id,financial_year_id,vendor_id,bill_number,bill_date,status,total_amount,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[bill.id,bill.company_id,bill.financial_year_id,bill.vendor_id,bill.bill_number,bill.bill_date,bill.status,bill.total_amount,bill.notes,bill.created_at])
        for(const item of items) run(db,'INSERT INTO purchase_bill_items (id,bill_id,company_id,product_id,description,quantity,unit_cost,line_total) VALUES (?,?,?,?,?,?,?,?)',[item.id,bill.id,activeCompanyId,item.product_id,item.description,item.quantity,item.unit_cost,item.line_total])
        recordAudit('purchase_bill.draft_created','purchase_bill',bill.id,{bill_number:billNumber,total_amount:total})
      })
      return bill
    },
    postPurchaseBill(billId) {
      const id=requiredText(billId,'Purchase bill ID',80)
      return withTransaction(()=>{
        const bill=rows(db,"SELECT * FROM purchase_bills WHERE id=? AND company_id=? AND status='draft'",[id,activeCompanyId])[0]
        if(!bill) throw new Error('Draft purchase bill was not found or is already posted.')
        const fy=rows(db,"SELECT id,start_date,end_date FROM financial_years WHERE id=? AND company_id=? AND status='active'",[bill.financial_year_id,activeCompanyId])[0]
        if(!fy||bill.bill_date<fy.start_date||bill.bill_date>fy.end_date) throw new Error('The purchase financial year is no longer active.')
        const items=rows(db,'SELECT * FROM purchase_bill_items WHERE bill_id=? AND company_id=?',[id,activeCompanyId])
        const at=new Date().toISOString()
        for(const item of items) run(db,'INSERT INTO stock_movements (id,company_id,product_id,movement_type,reference_type,reference_id,reference_item_id,quantity_delta,unit_cost,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[randomUUID(),activeCompanyId,item.product_id,'purchase','purchase_bill',id,item.id,item.quantity,item.unit_cost,at])
        run(db,"UPDATE purchase_bills SET status='posted',posted_at=? WHERE id=? AND company_id=?",[at,id,activeCompanyId])
        recordAudit('purchase_bill.posted','purchase_bill',id,{bill_number:bill.bill_number,total_amount:bill.total_amount,items:items.length})
        return this.getPurchaseBill(id)
      })
    },
    getPurchaseBill(billId) {
      const bill=rows(db,`SELECT b.*,v.name AS vendor_name,fy.label AS financial_year FROM purchase_bills b JOIN vendors v ON v.id=b.vendor_id JOIN financial_years fy ON fy.id=b.financial_year_id WHERE b.id=? AND b.company_id=?`,[requiredText(billId,'Purchase bill ID',80),activeCompanyId])[0]
      if(!bill) return null
      bill.items=rows(db,'SELECT id,product_id,description,quantity,unit_cost,line_total FROM purchase_bill_items WHERE bill_id=? AND company_id=?',[bill.id,activeCompanyId])
      return bill
    },
    reversePurchaseBill(billId, reason) {
      const id=requiredText(billId,'Purchase bill ID',80)
      const note=requiredText(reason,'Reversal reason',300)
      return withTransaction(()=>{
        const bill=rows(db,"SELECT * FROM purchase_bills WHERE id=? AND company_id=? AND status='posted'",[id,activeCompanyId])[0]
        if(!bill) throw new Error('Only a posted purchase bill can be reversed.')
        const items=rows(db,'SELECT * FROM purchase_bill_items WHERE bill_id=? AND company_id=?',[id,activeCompanyId])
        const reverseByProduct = new Map()
        for(const item of items) reverseByProduct.set(item.product_id,(reverseByProduct.get(item.product_id)||0)+item.quantity)
        for(const [productId,required] of reverseByProduct){
          const available=rows(db,'SELECT p.opening_stock + COALESCE(SUM(sm.quantity_delta),0) AS available FROM products p LEFT JOIN stock_movements sm ON sm.product_id=p.id AND sm.company_id=p.company_id WHERE p.id=? AND p.company_id=? GROUP BY p.id',[productId,activeCompanyId])[0]?.available??0
          if(available<required) throw new Error('Cannot reverse purchase; some purchased stock has already been sold or consumed.')
        }
        const at=new Date().toISOString()
        for(const item of items) run(db,'INSERT INTO stock_movements (id,company_id,product_id,movement_type,reference_type,reference_id,reference_item_id,quantity_delta,unit_cost,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[randomUUID(),activeCompanyId,item.product_id,'purchase_reversal','purchase_bill',id,item.id,-item.quantity,item.unit_cost,at])
        run(db,"UPDATE purchase_bills SET status='reversed',notes=COALESCE(notes,'') || ? WHERE id=? AND company_id=?",['\\nReversal: '+note,id,activeCompanyId])
        recordAudit('purchase_bill.reversed','purchase_bill',id,{reason:note})
        return this.getPurchaseBill(id)
      })
    },
    listStockMovements(productId = null, limit = 200) {
      const safeLimit=Math.max(1,Math.min(500,Math.floor(Number(limit)||200)))
      if(productId) return rows(db,`SELECT sm.*,p.name AS product_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id WHERE sm.company_id=? AND sm.product_id=? ORDER BY sm.created_at DESC LIMIT ?`,[activeCompanyId,requiredText(productId,'Product ID',80),safeLimit])
      return rows(db,`SELECT sm.*,p.name AS product_name FROM stock_movements sm JOIN products p ON p.id=sm.product_id WHERE sm.company_id=? ORDER BY sm.created_at DESC LIMIT ?`,[activeCompanyId,safeLimit])
    },
    getProductStock(productId) {
      const id=requiredText(productId,'Product ID',80)
      const result=rows(db,`SELECT p.id,p.name,p.sku,p.unit,p.opening_stock + COALESCE(SUM(sm.quantity_delta),0) AS current_stock
        FROM products p LEFT JOIN stock_movements sm ON sm.product_id=p.id AND sm.company_id=p.company_id
        WHERE p.id=? AND p.company_id=? GROUP BY p.id`,[id,activeCompanyId])[0]
      if(!result) throw new Error('Product was not found in the active company.')
      return result
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
        (SELECT COUNT(*) FROM sales_invoices WHERE company_id=? AND status='posted') AS invoices,
        (SELECT COUNT(*) FROM purchase_bills WHERE company_id=? AND status='posted') AS purchases,
        (SELECT COUNT(*) FROM audit_events) AS audit_events`, [activeCompanyId, activeCompanyId, activeCompanyId, activeCompanyId])
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
