# BIZORA Commercial Desktop Architecture

Status: implementation specification. This document is not a claim that cloud sync, licensing, backup, or production auto-update are already live.

## Product model
- Windows desktop client: Electron + React.
- Local-first operation: every business write is committed to the local database first.
- Cloud sync: an encrypted-in-transit API syncs queued changes when internet returns.
- Control plane: server-side licensing, device activation, release metadata, support and admin audit.
- Customer data is tenant-isolated. Never trust a tenant ID supplied by the renderer.

## Data and sync rules
1. Use a local SQLite database in Electron's app userData directory, never inside the install folder.
2. Use schema migrations with monotonically increasing versions; take a verified backup before migration.
3. Each local change creates an immutable outbox event with event_id (UUID), tenant_id, device_id, entity_type, entity_id, operation, payload, schema_version and created_at.
4. Upload events idempotently; server enforces a unique event_id constraint.
5. Download remote events using a per-device cursor. Apply in a transaction and advance cursor only after successful apply.
6. Use server timestamps and explicit conflict policies. Financial documents and stock movements are append-only; corrections use reversal/adjustment records, not silent overwrites.
7. For editable master data, use optimistic concurrency (row version). Conflicts go to a review queue; do not silently choose last-write-wins for financial data.
8. Show sync states: Local only, Sync pending, Synced, Conflict, and Sync failed. Offline use must not be blocked by cloud outage.
9. Never sync secrets, license private keys, or local encryption keys to the cloud.

## Local data protection and backup
- Keep database and attachments under app.getPath('userData').
- Encrypt sensitive local data at rest; protect per-install keys using Windows DPAPI. Do not hard-code a shared encryption key.
- Create SQLite consistent snapshots (SQLite backup API / transaction-safe method), verify integrity, and write to a temporary file before atomic rename.
- Retain rolling local backups (daily/weekly/monthly) with configurable retention.
- Optional cloud backup uploads encrypted archives; cloud sync is not a backup.
- Restore is explicit, validates archive checksum/schema, takes a pre-restore snapshot, then restores transactionally.
- Export/backup must remain available regardless of subscription tier.

## Licensing
- License issuance, plan entitlements, device limits and revocation are server-side only.
- Activation uses a one-time activation code exchanged over HTTPS for a signed license document.
- Signed license claims: license_id, tenant_id, plan, entitlements, device_id, issued_at, expires_at, offline_until, key_id.
- Desktop verifies signature against a pinned public key. The private signing key stays only in server-side secret storage.
- Enforce device limits and deactivate/revoke devices from the admin portal.
- Define grace behavior: cached license can run offline until offline_until; after that, allow read/export/backup and show reconnect/renew prompt. Do not lock customer data.
- Never put a master key, service-role key, or admin token in the Electron renderer or repository.

## Automatic updates
- Publish versioned Windows NSIS installers and latest.yml through GitHub Releases (or a private release server).
- Use electron-updater in the main process only; expose narrow update status/check/download/install IPC methods through preload.
- Check update metadata over HTTPS. Verify release authenticity and Windows code signature before install.
- Before applying an update: pause sync, create and verify local backup, close DB handles, install, then reopen and run migrations.
- If update or migration fails, preserve the backup and offer recovery/rollback. Never overwrite user data.
- Support staged rollout, minimum supported version, release notes, and emergency update disable.
- Production releases require a trusted Windows code-signing certificate. Do not distribute unsigned production installers as trusted releases.

## Required cloud services
A production backend is required for license activation, device registration, tenant-scoped sync, release policy and cloud backup. The current repository does not contain production credentials or a configured cloud project. Use a dedicated backend with server-side authorization and row-level tenant isolation. Do not place privileged backend keys in the desktop app.

## Delivery gates
- Gate 1: local SQLite persistence, migrations, backup/restore and offline UI.
- Gate 2: authenticated cloud API, tenant isolation, outbox/inbox sync and conflict review.
- Gate 3: signed licensing, activation, device management and offline grace.
- Gate 4: signed Windows installer, update feed, pre-update backup, rollback and staged release.
- Gate 5: security review, restore drills, multi-device sync tests, installer tests on clean Windows 10/11 machines.

Until all gates pass, label builds as TEST / PREVIEW and do not use them for real customer financial records.
