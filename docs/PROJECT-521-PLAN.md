# TRADEXO — Project 521 Master Plan

## Product direction
Premium international business ERP by FIXBYTE INDIA. Website first; Windows desktop software is downloadable from the website. Mobile app and payment gateway are postponed.

## Customer journey
1. Visitor explores website, features, plans and demo.
2. Customer creates an account (account backend is a future phase).
3. Customer downloads Windows software and starts with Basic.
4. Premium features remain visible but locked in Basic.
5. Customer submits Talk to Specialist enquiry.
6. Specialist contacts customer; payment is handled manually.
7. Owner Admin verifies payment and activates the chosen plan/license.
8. Desktop app validates entitlement online and stores a safe cached license for offline use.

Never unlock Premium solely because a customer says they paid.

## Plans
- Basic: basic billing, products/customers, basic stock, basic reports, offline/local data export and backup.
- Premium: advanced GST/billing, multi-company and multi-GSTIN workflows, warehouse, barcode/POS, advanced accounting, employee roles, advanced backup and reporting.
- Data export and essential backup must remain available in every plan.
- Proposed launch price: ₹1,499/year. Admin-configurable later.

## Notebook feature scope
- Invoice, credit note, e-invoice
- Purchase, purchase order, debit note
- Sales order, delivery challan, packing list
- Expenses and indirect income
- Digital POS and barcode
- Warehouse and inventory timeline
- Customers, business profiles and vendors
- Projects, insights and reports
- E-way bills
- My Drive and GST
- Invoice PDF/share, paid/unpaid, paid and balance amounts, shipping table, signature, edit, thermal printing, customer QR, invoice amount management
- Settings: customer profile, users/roles, company details, preferences, thermal print, barcode, signature, notes and terms
- Bank/payment details: UPI ID, account number, IFSC and address

## Website pages
Home, Features, Pricing, Demo, Download, Support, FAQ, Reviews, Contact and footer developer credit.

## Admin requirements
- Customer details, plan, enquiry/payment status, license ID, activation/renewal dates, installed version and activity history.
- No delete action for customer records. Use inactive/suspended/archived states.
- Enquiry states: New, Contacted, Follow-up, Converted, Rejected.
- Contact: WhatsApp/Call 7357204736, 10:00 AM–8:00 PM.
- Owner-only vs Owner + FIXBYTE team access remains to be confirmed.

## Design
Premium glass UI; white and dark themes; user-selectable theme saved in settings. Responsive website. Desktop UI designed for Windows.

## Roadmap
1. Project scaffold and public website foundation.
2. Website enquiry flow and local validation.
3. Desktop shell, local SQLite data layer and settings.
4. Basic billing, customers, products and stock.
5. Premium feature gating and licensing.
6. Owner admin portal and manual payment verification.
7. GST, purchase/sales, inventory, POS and reports.
8. Backup/restore, signed updates and rollback.
9. Security review, testing, installer and release.

## Safety and correctness
Tax calculations, e-invoice and e-way bill integrations require jurisdiction-specific validation and applicable APIs. Do not represent a draft invoice as a compliant e-invoice. Online license checks and updates require internet; offline workflows should continue under a valid cached entitlement policy.
