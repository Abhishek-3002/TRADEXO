# Phase 1 checklist

- [x] Create a GitHub-ready starter workspace.
- [x] Add website and desktop renderer build checks.
- [x] Verify website production build in GitHub Actions.
- [x] Verify desktop renderer production build in GitHub Actions.
- [x] Add the local database module and automated test suite on the development branch.
- [x] Wire customer and product screens to the local database.
- [x] Add encrypted local database storage and encrypted backup/restore flows.
- [x] Add the protected PIN/recovery foundation and trusted Electron IPC boundary.
- [x] Add company, GSTIN, financial-year, sales, purchase, inventory, receipts, supplier payments and ageing foundations.
- [x] Add the offline sync outbox/RPC foundation and automated unit tests (integration only; not production sync).
- [ ] Run the desktop application on Windows 10/11 and verify real installation.
- [ ] Verify safeStorage recovery, backup restore and crash recovery on Windows 10/11.
- [ ] Connect every business write to the sync outbox and transactionally apply pulled events.
- [ ] Complete tenant/device onboarding, token refresh, retry scheduling and conflict resolution.
- [ ] Complete roles/permissions, statutory GST workflows, license enforcement and signed updater.
- [ ] Complete security, tax, migration and release review before distributing installers.

## Release gate
Do not publish a customer download or call the product production-ready until Windows installation, migration, recovery, security, tax, licensing and end-to-end sync tests pass.
