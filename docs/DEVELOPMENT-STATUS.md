# BIZORA Project 521 — Development Status

Updated: 2026-11-04

Latest validation: GitHub Actions run 41705333359 passed on commit `e284eeba4ee0f425482f99dd00daf9511293e363` — website production build, desktop renderer build and all 37 database tests passed.

## Verified baseline
- Website production build, desktop renderer build and offline database tests passed in GitHub Actions run 41693236857.
- Multi-company, company-wise financial year and GST settings are implemented on `rename-to-bizora` in open PR #2; the PR remains unmerged.
- This repository is a development foundation, not a production-ready ERP.

## Supplier Payables Aging
- Reports workspace now includes a supplier payables aging summary using posted purchase bills and append-only supplier payment records.
- Fully paid and unposted bills are excluded; current, 1–30, 31–60, 61–90 and over-90-day buckets are calculated as of a selected date.
- Since purchase bills do not yet have due-date fields, the report ages balances from bill date and labels this limitation in the UI.

## Product default GST rate
- Product catalogue can store a default GST rate (0–100%); invoice and purchase lines inherit it unless the user explicitly enters a line-specific rate.
- Default tax rate is stored with the product and included in schema version 12 migrations and encrypted backup restore.

## Purchase-side GST
- Vendor records can store and validate a supplier GSTIN; purchase bills use supplier state and active company place-of-supply state to calculate intra-state CGST/SGST or inter-state IGST.
- Purchase bill and line records persist taxable value, tax split, GST rate, supplier GSTIN and supply type; registered vendor purchases use the shared paise-rounded tax engine.
- Unregistered vendor bills remain non-GST in this first pass; input-credit accounting, reverse-charge handling, GST return reconciliation and professional statutory review remain outstanding.
- Database schema version 11 migrates existing purchase records and supported encrypted backups.

## HSN / SAC item codes
- Product catalogue supports optional 2/4/6/8-digit HSN/SAC codes with validation.
- HSN/SAC is copied into sales invoice and purchase bill line records so later product edits do not rewrite historic document lines.
- Sales invoice print layout includes the HSN/SAC column; database schema version 10 upgrades existing databases and encrypted backups.

## Supplier payments
- Purchase bills now support company-scoped supplier payment entries with partial/full payment, outstanding balances and payment history.
- Supplier payment records are append-only with database update/delete guards; only posted bills can be paid and overpayments are rejected.
- Payment history is included in encrypted backups; schema version 9 migrates existing databases and supported backups.

## Company profile
- Active company profile stores business/trade name, legal name, address, phone, email, website and optional bank details (account holder, account number, IFSC and branch).
- Profile changes are company-scoped, audited and included in encrypted backups; email, website and IFSC formats are validated.
- Sales invoice preview prints saved company address/contact details and optional bank payment details.
- Database schema version 8 upgrades existing local databases and supported encrypted backups without discarding records.

## Offline data foundation
- SQL.js database is stored in Electron's per-user application data folder.
- Database snapshots are encrypted through Electron safeStorage before disk writes; the app refuses plaintext disk writes if secure storage is unavailable. Earlier plaintext development databases are imported and rewritten in encrypted form on startup.
- Narrow preload/IPC API; renderer receives no direct filesystem or SQL access.
- Customer and product create/list screens use local storage.
- Customer/product records are assigned to the active company and list queries are scoped to that company.
- Multiple companies can be created and switched from Company Settings.
- Multiple GSTIN registrations can be recorded per company; the app checks the 15-character format only and does not verify GST portal status.
- Financial years can be created and switched per company; overlapping periods are rejected and the database enforces at most one active financial year per company.
- Company-wise GST defaults include GST enabled/disabled, selected active GSTIN, inclusive/exclusive tax mode and place-of-supply state code.
- Sales invoice creation now uses the GST calculation engine: per-line GST rate, inclusive/exclusive pricing, intra-state CGST/SGST, inter-state IGST, paise rounding, and saved invoice-level and line-level tax breakup. Supply type is derived from seller GSTIN state code versus configured place-of-supply state code.
- Sales invoice drafts and supplier purchase bill drafts are company- and financial-year-scoped; posting requires an active financial year and valid company party/product records.
- Posting a sales invoice writes negative stock movements after checking available stock; posting a purchase bill writes positive stock movements.
- Posted sales and purchase documents can be reversed only with a reason; reversal writes compensating movements and never deletes original document or stock history.
- Stock movement rows have database triggers preventing updates/deletes. Current stock is opening stock plus posted movements.
- Draft creation and posting use database transactions; failed posting rolls back document and stock writes. Duplicate invoice/bill numbers are blocked per company and financial year.
- Encrypted backups preserve financial year, company tax settings, receipt ledger and invoice tax details; older supported backup schemas are upgraded to the current schema during restore.
- Customer receipts are stored in a company-scoped append-only ledger; partial/full payment, overpayment checks, payment history and invoice outstanding balances are integrated with invoice records.
- Receivables Aging reports use posted invoices and persisted customer receipts, grouped into current, 1–30, 31–60, 61–90 and 90+ day buckets.
- Existing single-company records are migrated into the first company when the database is upgraded.
- Append-only audit events are written for company creation/switching and customer/product/GSTIN creation.
- Encrypted backup export and validated restore are available from the desktop Data Backup screen. Restore requires confirmation, validates encryption, SQLite integrity, schema version and required tables, and leaves current data intact if validation fails.
- No customer or product delete API is exposed.

## Known limitations — do not use for live business records yet
- Encryption uses Electron safeStorage tied to the Windows OS account; cross-device/account recovery and tested recovery procedures are not implemented. Use synthetic data until Windows recovery tests are complete.
- GSTIN format validation is not government verification or tax advice. GST calculation requires the user to choose the applicable rate for each invoice line and correctly configure seller GSTIN and place-of-supply state; calculations are not a substitute for a tax professional's review.
- Product SKU uniqueness is scoped to each company by a schema migration; the migration and cross-company SKU test pass in CI.
- GST calculation is now integrated into sales invoice draft creation, but tax invoice PDF, e-invoice, e-way bill, GST portal filing, purchase-side GST accounting and full statutory validation are not complete.
- Input GST credit accounting, reverse-charge handling, GST return reconciliation, supplier payable ageing/summary, purchase accounting, role permissions, sync conflict resolution, license enforcement and signed updater are not complete.
- Invoice and purchase registers include reason-required reversal actions; reversal adds compensating stock entries rather than deleting the posted document.
- SQL.js persists a complete database snapshot on each write; performance must be load-tested before larger deployments.
- Windows installer and real Windows 10/11 installation have not yet been validated.

## Next milestones
1. Add product/item HSN/SAC and product-level tax defaults; validate invoice tax treatment with a qualified GST professional.
2. Add input GST credit accounting, supplier payable ageing/summary and purchase accounting integration.
3. Add role permissions and enforce explicit company/GSTIN/financial-year selection before posting tax transactions.
4. Test Windows encryption recovery, backup restore and crash recovery on Windows 10/11.
5. Implement offline-first sync with idempotency, conflict handling and server-side authorization.
6. Implement licensing, admin activation and signed automatic updates.
7. Validate GST/e-invoice/e-way bill requirements with applicable official APIs and professional review.
8. Build and test a signed Windows installer on Windows 10/11.

## Release gate
Do not publish a customer download or call the product production-ready until Windows installation, migration, recovery, security, tax and sync tests pass.
