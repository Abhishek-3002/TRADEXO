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
INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', '1');
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

async function openLocalDatabase(filePath = null) {
  const initSqlJs = require('sql.js')
  const wasmDirectory = path.dirname(require.resolve('sql.js'))
  const SQL = await initSqlJs({ locateFile: file => path.join(wasmDirectory, file) })
  let db
  if (filePath && fs.existsSync(filePath)) {
    db = new SQL.Database(new Uint8Array(fs.readFileSync(filePath)))
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
    `)
  }
  run(db, "INSERT OR REPLACE INTO app_meta (key,value) VALUES ('schema_version','3')")

  function persist() {
    if (!filePath) return
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    const temporaryPath = filePath + '.tmp'
    fs.writeFileSync(temporaryPath, Buffer.from(db.export()))
    fs.renameSync(temporaryPath, filePath)
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
