# TRADEXO desktop offline sync integration

## Current implementation

The Electron main process now exposes a narrow `window.tradexo.sync` bridge:

- `enqueue(event)`: append an immutable event to the encrypted local queue.
- `pendingCount()`: return the number of queued events.
- `pushPending(context)`: upload up to 200 queued events through `tx_push_sync_events`.
- `pullEvents(context, limit)`: fetch the next page through `tx_pull_sync_events`.
- `acknowledgePulled(context, cursor)`: persist the last fully applied server cursor.

The queue and pull cursors are stored in the Electron user-data directory, encrypted using Electron `safeStorage` (Windows OS-backed encryption). The access token is never persisted by this module.

## Required context

Pass the following object to push/pull/acknowledge methods:

- `tenantId`: selected tenant UUID.
- `deviceId`: registered device UUID belonging to that tenant and signed-in user.
- `supabaseUrl`: Supabase project URL (HTTPS outside local development).
- `anonKey`: Supabase publishable/anon key.
- `accessToken`: current authenticated user's short-lived access token.

Do not pass a service-role key to the desktop client. Refresh the access token through the app's authenticated Supabase session when needed.

## Event contract

Each event must be immutable and contain:

```json
{
  "event_id": "UUID",
  "entity_type": "sales_invoice",
  "entity_id": "local-stable-id",
  "operation": "create",
  "payload": {},
  "schema_version": 1,
  "client_created_at": "2026-11-04T12:00:00.000Z"
}
```

Use a new UUID for every business change. Do not reuse an event UUID for a different change. Represent corrections as new events (for example, a reversal) rather than mutating a previously queued event.

## Safe pull procedure

1. Call `pullEvents(context, 200)`.
2. Apply the returned events to the local database in a single local transaction, deduplicating by `event_id`.
3. Only after the local transaction commits, call `acknowledgePulled(context, { receivedAt: last.server_received_at, eventId: last.event_id })`.
4. If local application fails, do not acknowledge the page; it will be fetched again.

## Important limitations before production

- This bridge is not yet called by the current React screens; business writes must be converted into events and enqueued from the local database transaction.
- The current starter UI has no completed login/session flow or device registration flow. Supply context only after those are implemented.
- The Supabase migration has not been applied or exercised against a live project. Verify table names, RLS, grants and migration order before applying it.
- No local business-record projection/apply handler, conflict-resolution UI, automatic reconnect scheduler, retry/backoff, token refresh wiring or multi-device integration tests are included yet.
- `safeStorage` depends on the Windows user profile. Recovery requires a separate encrypted backup strategy; this queue is not a backup.
- Do not use this foundation as the sole copy of production business data until end-to-end tests and restore drills pass.


## Validation workflow
The repository build workflow now runs pull-request checks when this development branch is the target. The integration pull request will be validated by the same website production build, desktop automated tests and desktop renderer build used by the main development branch.
