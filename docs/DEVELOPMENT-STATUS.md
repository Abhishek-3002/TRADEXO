# BIZORA Project 521 — Development Status

Updated: 2026-11-03

Latest validation: GitHub Actions run 41694354825 passed (website build, desktop build and all seven database tests).

## Verified baseline
- Website production build, desktop renderer build and offline database tests passed in GitHub Actions run 41693236857.
- Multi-company/GSTIN work is proposed on the `rename-to-bizora` branch in open PR #2; latest checks are running.
- This repository is a development foundation, not a production-ready ERP.

## Offline data foundation
- SQL.js database is stored in Electron's per-user application data folder.\n- Database snapshots are encrypted through Electron safeStorage before disk writes; the app refuses plaintext disk writes if secure storage is unavailable. Earlier plaintext development databases are imported and rewritten in encrypted form on startup.
- Narrow preload/IPC API; renderer receives no direct filesystem or SQL access.
- Customer and product create/list screens use local storage.
- Customer/product records are assigned to the active company and list queries are scoped to that company.
- Multiple companies can be created and switched from Company Settings.
- Multiple GSTIN registrations can be recorded per company; the app checks the 15-character format only and does not verify GST portal status.
- Existing single-company records are migrated into the first company when the database is upgraded.
- Append-only audit events are written for company creation/switching and customer/product/GSTIN creation.
- No customer or product delete API is exposed.

## Known limitations — do not use for live business records yet
- Database file is not encrypted at rest. Use only synthetic test data until encryption and recovery are implemented and reviewed.
- GSTIN format validation is not government verification or tax advice.
- Product SKU uniqueness is scoped to each company by a schema migration; the migration and cross-company SKU test pass in CI.
- Invoice posting, immutable stock ledger, tax calculations, role permissions, backup/restore, sync conflict resolution, license enforcement and signed updater are not complete.
- SQL.js persists a complete database snapshot on each write; performance must be load-tested before larger deployments.
- Windows installer and real Windows 10/11 installation have not yet been validated.

## Next milestones
1. Pass CI for multi-company/GSTIN changes and test migration from the earlier single-company database.
2. Add company-wise financial year/tax profile and GST tax settings.
3. Implement backup/restore and crash-recovery tests before any real data.
4. Add invoices and immutable sales/stock ledgers using transaction-safe posting and reversal (not deletion).
5. Add role permissions and explicit company/GSTIN selection before tax transactions.
6. Implement offline-first sync with idempotency, conflict handling and server-side authorization.
7. Implement licensing, admin activation and signed automatic updates.
8. Validate GST/e-invoice/e-way bill requirements with applicable official APIs and professional review.
9. Build and test a signed Windows installer on Windows 10/11.

## Release gate
Do not publish a customer download or call the product production-ready until Windows installation, migration, backup/restore, recovery, security, tax and sync tests pass.
