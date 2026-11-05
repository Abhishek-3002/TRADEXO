const fs = require('node:fs')
const path = require('node:path')
function createSyncEngine(app, storage = require('electron').safeStorage) {
  const statePath = path.join(app.getPath('userData'), 'sync-state.enc')

  function readState() {
    if (!fs.existsSync(statePath)) return { queue: [], cursors: {} }
    if (!storage.isEncryptionAvailable()) {
      throw new Error('OS-backed encryption is unavailable; sync state was not opened.')
    }
    const encrypted = fs.readFileSync(statePath)
    const state = JSON.parse(storage.decryptString(encrypted))
    return {
      queue: Array.isArray(state.queue) ? state.queue : [],
      cursors: state.cursors && typeof state.cursors === 'object' ? state.cursors : {}
    }
  }

  function writeState(state) {
    if (!storage.isEncryptionAvailable()) {
      throw new Error('OS-backed encryption is unavailable; sync state was not saved.')
    }
    fs.mkdirSync(path.dirname(statePath), { recursive: true })
    const encrypted = storage.encryptString(JSON.stringify(state))
    const tempPath = statePath + '.tmp'
    fs.writeFileSync(tempPath, encrypted, { mode: 0o600 })
    fs.renameSync(tempPath, statePath)
  }

  function validateContext(context) {
    if (!context || typeof context !== 'object') throw new Error('Sync context is required.')
    for (const key of ['tenantId', 'deviceId', 'supabaseUrl', 'anonKey', 'accessToken']) {
      if (typeof context[key] !== 'string' || !context[key].trim()) {
        throw new Error('Missing sync context: ' + key)
      }
    }
    const url = new URL(context.supabaseUrl)
    if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      throw new Error('Supabase URL must use HTTPS.')
    }
    return { ...context, supabaseUrl: url.origin }
  }

  async function rpc(context, name, body) {
    const c = validateContext(context)
    const response = await fetch(c.supabaseUrl + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        apikey: c.anonKey,
        Authorization: 'Bearer ' + c.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = payload && (payload.message || payload.error_description || payload.error)
      throw new Error(message || 'Sync request failed with HTTP ' + response.status)
    }
    return payload
  }

  function validateEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('A sync event object is required.')
    const required = ['event_id', 'entity_type', 'entity_id', 'operation', 'client_created_at']
    for (const key of required) {
      if (typeof event[key] !== 'string' || !event[key].trim()) throw new Error('Invalid sync event field: ' + key)
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.event_id)) throw new Error('event_id must be a UUID.')
    if (!['create', 'update', 'reverse', 'archive'].includes(event.operation)) throw new Error('Unsupported sync event operation.')
    if (event.entity_type.length > 80 || event.entity_id.length > 160) throw new Error('Sync event identity exceeds supported limits.')
    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) throw new Error('Sync event payload must be an object.')
    if (!Number.isInteger(event.schema_version ?? 1) || (event.schema_version ?? 1) < 1) throw new Error('Invalid sync event schema_version.')
    if (!Number.isFinite(Date.parse(event.client_created_at))) throw new Error('Invalid sync event timestamp.')
    const safeEvent = JSON.parse(JSON.stringify({ ...event, schema_version: event.schema_version ?? 1 }))
    if (Buffer.byteLength(JSON.stringify(safeEvent), 'utf8') > 262144) throw new Error('Sync event exceeds the 256 KB limit.')
    return safeEvent
  }

  return {
    enqueue(event) {
      const safeEvent = validateEvent(event)
      const state = readState()
      if (!state.queue.some(item => item.event_id === safeEvent.event_id)) {
        if (state.queue.length >= 10000) throw new Error('Offline queue is full; sync before adding more changes.')
        state.queue.push(safeEvent)
        writeState(state)
      }
      return { pending: state.queue.length }
    },

    pendingCount() {
      return { pending: readState().queue.length }
    },

    async pushPending(context) {
      const c = validateContext(context)
      const state = readState()
      if (!state.queue.length) return { accepted: 0, duplicates: 0, pending: 0 }
      const batch = state.queue.slice(0, 200)
      const result = await rpc(c, 'tx_push_sync_events', {
        p_tenant_id: c.tenantId,
        p_device_id: c.deviceId,
        p_events: batch
      })
      const summary = Array.isArray(result) ? result[0] : result
      const accepted = Number(summary && summary.accepted_count)
      const duplicates = Number(summary && summary.duplicate_count)
      if (!Number.isInteger(accepted) || !Number.isInteger(duplicates) || accepted + duplicates !== batch.length) {
        throw new Error('Server acknowledgement did not match the uploaded batch; local queue was preserved.')
      }
      const sentIds = new Set(batch.map(item => item.event_id))
      // Re-read after the network request so events enqueued while the request
      // was in flight are not overwritten by this acknowledgement write.
      const latestState = readState()
      latestState.queue = latestState.queue.filter(item => !sentIds.has(item.event_id))
      writeState(latestState)
      return { accepted, duplicates, pending: latestState.queue.length }
    },

    async pullEvents(context, limit = 200) {
      const c = validateContext(context)
      const state = readState()
      const cursor = state.cursors[c.tenantId + ':' + c.deviceId] || null
      const rows = await rpc(c, 'tx_pull_sync_events', {
        p_tenant_id: c.tenantId,
        p_device_id: c.deviceId,
        p_after_received_at: cursor && cursor.receivedAt,
        p_after_event_id: cursor && cursor.eventId,
        p_limit: Math.min(Math.max(Number(limit) || 200, 1), 500)
      })
      return Array.isArray(rows) ? rows : []
    },

    acknowledgePulled(context, cursor) {
      const c = validateContext(context)
      if (!cursor || typeof cursor.receivedAt !== 'string' || typeof cursor.eventId !== 'string') {
        throw new Error('A valid server cursor is required.')
      }
      const state = readState()
      state.cursors[c.tenantId + ':' + c.deviceId] = cursor
      writeState(state)
      return { saved: true }
    }
  }
}

module.exports = { createSyncEngine }
