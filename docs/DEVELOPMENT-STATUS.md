# BIZORA Project 521 — Development Status

Updated: 2026-11-04

Latest validation: GitHub Actions pull-request run 41697305119 passed on commit `5170abe0acf5707de6629a9d5fb94377a305a2ae` — website production build, desktop renderer build and all 17 database tests passed.

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
- Sales invoice drafts and supplier purchase bill drafts are company- and financial-year-scoped; posting requires an active financial year and valid company party/product records.
- Posting a sales invoice writes negative stock movements after checking available stock; posting a purchase bill writes positive stock movements.
- Posted sales and purchase documents can be reversed only with a reason; reversal writes compensating movements and never deletes original document or stock history.
- Stock movement rows have database triggers preventing updates/deletes. Current stock is opening stock plus posted movements.
- Draft creation and posting use database transactions; failed posting rolls back document and stock writes. Duplicate invoice/bill numbers are blocked per company and financial year.
- Encrypted backups preserve financial year and company tax settings; version-3 backups are upgraded to the current schema during restore.
- Existing single-company records are migrated into the first company when the database is upgraded.
- Append-only audit events are written for company creation/switching and customer/product/GSTIN creation.
- Encrypted backup export and validated restore are available from the desktop Data Backup screen. Restore requires confirmation, validates encryption, SQLite integrity, schema version and required tables, and leaves current data intact if validation fails.
- No customer or product delete API is exposed.

## Known limitations — do not use for live business records yet
- Encryption uses Electron safeStorage tied to the Windows OS account; cross-device/account recovery and tested recovery procedures are not implemented. Use synthetic data until Windows recovery tests are complete.
- GSTIN format validation is not government verification or tax advice.
- Product SKU uniqueness is scoped to each company by a schema migration; the migration and cross-company SKU test pass in CI.
- GST/tax calculations, tax invoice PDF, payment/receivable ledgers, purchase accounting, role permissions, sync conflict resolution, license enforcement and signed updater are not complete.
- Invoice and purchase registers include reason-required reversal actions; reversal adds compensating stock entries rather than deleting the posted document.
- SQL.js persists a complete database snapshot on each write; performance must be load-tested before larger deployments.
- Windows installer and real Windows 10/11 installation have not yet been validated.

## Next milestones
1. Complete invoice/purchase document UX, reversals, printable invoice/PDF and customer/vendor management.
2. Add reviewed GST calculation rules and invoice-level GSTIN context with tax breakup and professional review.
3. Add role permissions and enforce explicit company/GSTIN/financial-year selection before posting tax transactions.
4. Test Windows encryption recovery, backup restore and crash recovery on Windows 10/11.
5. Implement offline-first sync with idempotency, conflict handling and server-side authorization.
6. Implement licensing, admin activation and signed automatic updates.
7. Validate GST/e-invoice/e-way bill requirements with applicable official APIs and professional review.
8. Build and test a signed Windows installer on Windows 10/11.

## Release gate
Do not publish a customer download or call the product production-ready until Windows installation, migration, recovery, security, tax and sync tests pass.
