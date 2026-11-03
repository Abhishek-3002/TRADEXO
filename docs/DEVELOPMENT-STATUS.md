# BIZORA Project 521 — Development Status

Updated: 2026-11-03

## Verified baseline
- Website and Electron/Vite renderer production builds passed in GitHub Actions run 41691595285.
- Rebranding is proposed on the `rename-to-bizora` branch and remains in an open pull request.
- This repository is a starter foundation, not a production-ready ERP.

## Offline data foundation (current phase)
- SQL.js database stored in the Electron app's per-user application data folder.
- Initial local tables: company profile, customers, products and append-only audit events.
- Narrow preload/IPC API; renderer does not receive direct filesystem or SQL access.
- Initial automated tests cover create/list, persistence after reopen and validation.
- No delete API is exposed for customer or product records.

## Known limitations — do not use for live business records yet
- Database file is not encrypted at rest. Use only synthetic test data until encryption and recovery are implemented and reviewed.
- No multi-company transaction context, invoice posting, stock ledger, GST calculations, sync conflict resolution, backup/restore, license enforcement or signed updater is complete.
- The current dashboard is a preview and is not yet wired to all local database operations.
- SQL.js persists a complete database snapshot on each write; this is suitable only for the starter dataset and must be load-tested before larger deployments.

## Next milestones
1. Wire customer/product screens to the local database and add edit/archive workflows with audit history.
2. Add invoices and immutable sales/stock ledgers using transaction-safe posting and reversal (not deletion).
3. Add company/GSTIN isolation and role permissions.
4. Implement backup/restore, database encryption and crash-recovery tests.
5. Implement offline-first sync with idempotency, conflict handling and server-side authorization.
6. Implement licensing, admin activation and signed automatic updates.
7. Validate GST/e-invoice/e-way bill requirements with applicable official APIs and professional review.
8. Build and test a signed Windows installer on Windows 10/11.

## Release gate
Do not publish a customer download or call the product production-ready until the Windows installer, database recovery, security, tax and sync tests pass.
