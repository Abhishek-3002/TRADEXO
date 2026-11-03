# BIZORA Project 521 — Development Status

Updated: 2026-11-04

Latest feature validation: GitHub Actions pull-request run 41695813418 passed on feature commit `e653035290cd193e5ff3c8c1348c248a881185a7` (website build, desktop build and all eleven database tests). A follow-up commit adds the same active-financial-year database constraint to legacy-backup upgrades; its CI is running.

## Verified baseline
- Website production build, desktop renderer build and offline database tests passed in GitHub Actions run 41693236857.
- Multi-company, company-wise financial year and GST settings are implemented on `rename-to-bizora` in open PR #2; the PR remains unmerged.
- This repository is a development foundation, not a production-ready ERP.

## Offline data foundation
- SQL.js database is stored in Electron's per-user application data folder.
- Database snapshots are encrypted through Electron safeStorage before disk writes; the app refuses plaintext disk writes if secure storage is unavailable. Earlier plaintext development databases are imported and rewritten in encrypted form on startup.
- Narrow preload/IPC API; renderer receives no direct filesystem or SQL access.
- Customer and product create/list screens use local storage.
- Customer/product records are assigned to the active company and list queries are scoped to that company.
- Multiple companies can be created and switched from Company Settings.
- Multiple GSTIN registrations can be recorded per company; the app checks the 15-character format only and does not verify GST portal status.
- Financial years can be created and switched per company; overlapping periods are rejected and the database enforces at most one active financial year per company.
- Company-wise GST defaults include GST enabled/disabled, selected active GSTIN, inclusive/exclusive tax mode and place-of-supply state code; these are settings only, not a tax calculation engine.
- Encrypted backups preserve financial year and company tax settings; version-3 backups are upgraded to the current schema during restore.
- Existing single-company records are migrated into the first company when the database is upgraded.
- Append-only audit events are written for company creation/switching and customer/product/GSTIN creation.
- Encrypted backup export and validated restore are available from the desktop Data Backup screen. Restore requires confirmation, validates encryption, SQLite integrity, schema version and required tables, and leaves current data intact if validation fails.
- No customer or product delete API is exposed.

## Known limitations — do not use for live business records yet
- Encryption uses Electron safeStorage tied to the Windows OS account; cross-device/account recovery and tested recovery procedures are not implemented. Use synthetic data until Windows recovery tests are complete.
- GSTIN format validation is not government verification or tax advice.
- Product SKU uniqueness is scoped to each company by a schema migration; the migration and cross-company SKU test pass in CI.
- Invoice posting, immutable stock ledger, tax calculations, role permissions, sync conflict resolution, license enforcement and signed updater are not complete.
- SQL.js persists a complete database snapshot on each write; performance must be load-tested before larger deployments.
- Windows installer and real Windows 10/11 installation have not yet been validated.

## Next milestones
1. Add invoice and purchase workflows with transaction-safe posting, immutable stock movements and reversal (not deletion).
2. Add tax calculation rules and invoice-level GSTIN/financial-year context with explicit validation and professional review.
3. Add role permissions and enforce explicit company/GSTIN/financial-year selection before posting tax transactions.
4. Test Windows encryption recovery, backup restore and crash recovery on Windows 10/11.
5. Implement offline-first sync with idempotency, conflict handling and server-side authorization.
6. Implement licensing, admin activation and signed automatic updates.
7. Validate GST/e-invoice/e-way bill requirements with applicable official APIs and professional review.
8. Build and test a signed Windows installer on Windows 10/11.

## Release gate
Do not publish a customer download or call the product production-ready until Windows installation, migration, recovery, security, tax and sync tests pass.
