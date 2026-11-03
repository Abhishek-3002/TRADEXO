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
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
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
    getSummary() {
      const result = rows(db, `SELECT
        (SELECT COUNT(*) FROM customers WHERE status='active') AS customers,
        (SELECT COUNT(*) FROM products WHERE status='active') AS products,
        (SELECT COUNT(*) FROM audit_events) AS audit_events`)
      return result[0]
    },
    listCustomers(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)))
      return rows(db, 'SELECT id,name,phone,email,address,status,created_at FROM customers ORDER BY created_at DESC LIMIT ?', [safeLimit])
    },
    createCustomer(input = {}) {
      const customer = {
        id: randomUUID(),
        name: requiredText(input.name, 'Customer name'),
        phone: optionalText(input.phone, 'Phone', 30),
        email: optionalText(input.email, 'Email', 160),
        address: optionalText(input.address, 'Address', 500),
        created_at: new Date().toISOString()
      }
      run(db, 'INSERT INTO customers (id,name,phone,email,address,created_at) VALUES (?,?,?,?,?,?)',
        [customer.id, customer.name, customer.phone, customer.email, customer.address, customer.created_at])
      recordAudit('customer.created', 'customer', customer.id, { name: customer.name })
      persist()
      return customer
    },
    listProducts(limit = 100) {
      const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 100)))
      return rows(db, 'SELECT id,name,sku,unit,selling_price,opening_stock,status,created_at FROM products ORDER BY created_at DESC LIMIT ?', [safeLimit])
    },
    createProduct(input = {}) {
      const product = {
        id: randomUUID(),
        name: requiredText(input.name, 'Product name'),
        sku: optionalText(input.sku, 'SKU', 60),
        unit: optionalText(input.unit, 'Unit', 20) || 'pcs',
        selling_price: nonNegativeNumber(input.sellingPrice, 'Selling price'),
        opening_stock: nonNegativeNumber(input.openingStock, 'Opening stock'),
        created_at: new Date().toISOString()
      }
      run(db, 'INSERT INTO products (id,name,sku,unit,selling_price,opening_stock,created_at) VALUES (?,?,?,?,?,?,?)',
        [product.id, product.name, product.sku, product.unit, product.selling_price, product.opening_stock, product.created_at])
      recordAudit('product.created', 'product', product.id, { name: product.name })
      persist()
      return product
    },
    close() { db.close() }
  })
}

module.exports = { openLocalDatabase }
