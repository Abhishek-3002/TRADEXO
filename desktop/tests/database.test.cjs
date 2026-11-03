const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const testKey = Buffer.alloc(32, 23)
const testEncryption = {
  encrypt(data) {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', testKey, iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted])
  },
  decrypt(data) {
    const iv = data.subarray(0, 12)
    const tag = data.subarray(12, 28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', testKey, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()])
  }
}
const { openLocalDatabase } = require('../electron/database.cjs')

test('creates customers and products and records append-only audit events', async () => {
  const db = await openLocalDatabase()
  const customer = db.createCustomer({ name: 'Test Customer', phone: '9876543210' })
  const product = db.createProduct({ name: 'Test Item', sku: 'TEST-01', sellingPrice: 25, openingStock: 4 })
  assert.equal(db.listCustomers()[0].id, customer.id)
  assert.equal(db.listProducts()[0].id, product.id)
  assert.deepEqual(db.getSummary(), { customers: 1, products: 1, audit_events: 2 })
  assert.equal(typeof db.deleteCustomer, 'undefined')
  db.close()
})

test('persists records after reopening the local database', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bizora-db-'))
  const file = path.join(folder, 'bizora.sqlite')
  const first = await openLocalDatabase(file, testEncryption)
  first.createCustomer({ name: 'Persistent Customer' })
  first.close()
  const stored = fs.readFileSync(file)
  assert.equal(stored.subarray(0, Buffer.byteLength('BIZORA_DB_ENC_V1\\n')).toString(), 'BIZORA_DB_ENC_V1\\n')
  assert.equal(stored.includes(Buffer.from('Persistent Customer')), false)
  const second = await openLocalDatabase(file, testEncryption)
  assert.equal(second.listCustomers()[0].name, 'Persistent Customer')
  second.close()
  fs.rmSync(folder, { recursive: true, force: true })
})

test('rejects invalid customer and product values', async () => {
  const db = await openLocalDatabase()
  assert.throws(() => db.createCustomer({ name: ' ' }), /Customer name is required/)
  assert.throws(() => db.createProduct({ name: 'Item', sellingPrice: -1 }), /non-negative/)
  db.close()
})

test('keeps customer and product records isolated by active company', async () => {
  const db = await openLocalDatabase()
  const firstCompany = db.getCurrentCompany()
  db.createCustomer({ name: 'First Company Customer' })
  db.createProduct({ name: 'First Company Item', sellingPrice: 10, openingStock: 2 })
  const secondCompany = db.createCompany({ businessName: 'Second Company', legalName: 'Second Company Pvt Ltd' })
  db.setActiveCompany(secondCompany.id)
  assert.equal(db.listCustomers().length, 0)
  assert.equal(db.listProducts().length, 0)
  db.createCustomer({ name: 'Second Company Customer' })
  db.setActiveCompany(firstCompany.id)
  assert.equal(db.listCustomers()[0].name, 'First Company Customer')
  assert.equal(db.listProducts()[0].name, 'First Company Item')
  db.close()
})

test('stores GSTIN registrations against the selected company and validates format', async () => {
  const db = await openLocalDatabase()
  const company = db.getCurrentCompany()
  const registration = db.addCompanyGstin({ gstin: '08ABCDE1234F1Z5', label: 'Rajasthan GST' })
  assert.equal(registration.company_id, company.id)
  assert.equal(registration.state_code, '08')
  assert.equal(db.listCompanyGstins()[0].gstin, '08ABCDE1234F1Z5')
  assert.throws(() => db.addCompanyGstin({ gstin: 'INVALID' }), /valid 15-character GSTIN/)
  db.close()
})

test('allows the same SKU in different companies but prevents duplicates within one company', async () => {
  const db = await openLocalDatabase()
  const first = db.getCurrentCompany()
  db.createProduct({ name: 'Item A', sku: 'SHARED-01', sellingPrice: 10, openingStock: 1 })
  assert.throws(() => db.createProduct({ name: 'Duplicate in A', sku: 'SHARED-01' }))
  const second = db.createCompany({ businessName: 'Another Company' })
  db.setActiveCompany(second.id)
  assert.doesNotThrow(() => db.createProduct({ name: 'Item B', sku: 'SHARED-01', sellingPrice: 20, openingStock: 2 }))
  db.setActiveCompany(first.id)
  assert.equal(db.listProducts().length, 1)
  db.close()
})

test('refuses to save a disk database without an encryption provider', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bizora-no-plain-'))
  const file = path.join(folder, 'bizora.sqlite')
  await assert.rejects(() => openLocalDatabase(file), /encryption is required/)
  assert.equal(fs.existsSync(file), false)
  fs.rmSync(folder, { recursive: true, force: true })
})
