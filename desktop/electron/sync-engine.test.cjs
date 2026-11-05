const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createSyncEngine } = require('./sync-engine.cjs')

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tradexo-sync-'))
  const app = { getPath: () => dir }
  const storage = {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from(value, 'utf8'),
    decryptString: value => Buffer.from(value).toString('utf8')
  }
  return { engine: createSyncEngine(app, storage), dir }
}

const event = () => ({
  event_id: 'f3b7e8a1-5d4c-4b2a-9a1e-123456789abc',
  entity_type: 'sales_invoice',
  entity_id: 'invoice-local-1',
  operation: 'create',
  payload: { total: 1250 },
  schema_version: 1,
  client_created_at: '2026-11-04T12:00:00.000Z'
})

test('offline queue stores events and ignores repeated event UUIDs', t => {
  const { engine, dir } = setup()
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  assert.deepEqual(engine.enqueue(event()), { pending: 1 })
  assert.deepEqual(engine.enqueue(event()), { pending: 1 })
  assert.deepEqual(engine.pendingCount(), { pending: 1 })
})

test('offline queue rejects malformed or oversized events', t => {
  const { engine, dir } = setup()
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  assert.throws(() => engine.enqueue({ ...event(), event_id: 'not-a-uuid' }), /UUID/)
  assert.throws(() => engine.enqueue({ ...event(), operation: 'delete' }), /operation/)
  assert.throws(() => engine.enqueue({ ...event(), payload: { data: 'x'.repeat(270000) } }), /256 KB/)
  assert.deepEqual(engine.pendingCount(), { pending: 0 })
})

test('push preserves queue when server acknowledgement is incomplete', async t => {
  const { engine, dir } = setup()
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  engine.enqueue(event())
  const originalFetch = global.fetch
  t.after(() => { global.fetch = originalFetch })
  global.fetch = async () => ({ ok: true, json: async () => [{ accepted_count: 0, duplicate_count: 0 }] })
  const context = {
    tenantId: 'tenant-1', deviceId: 'device-1',
    supabaseUrl: 'https://example.supabase.co', anonKey: 'public-key', accessToken: 'test-token'
  }
  await assert.rejects(engine.pushPending(context), /acknowledgement/)
  assert.deepEqual(engine.pendingCount(), { pending: 1 })
})
