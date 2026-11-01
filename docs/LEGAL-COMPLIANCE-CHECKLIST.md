# TRADEXO Legal & Privacy Compliance — Launch Checklist

**Status:** Draft baseline added 1 November 2026. Not a certification or legal opinion.

## Important legal reality
No Terms & Conditions clause can prevent a government notice, investigation, statutory penalty or valid claim. The DPDP Act, 2023 and DPDP Rules, 2025 impose real obligations. The Government's 17 November 2025 summary says the maximum penalty of up to ₹250 crore can apply to failure by a Data Fiduciary to maintain reasonable security safeguards. A disclaimer cannot waive statutory duties.

## Added in this repository
- website/public/terms-and-conditions.html
- website/public/privacy-policy.html
- Website footer links and enquiry-form acknowledgement/consent (website app update is tracked separately).
- This checklist.

## Must complete before launch
- [ ] Confirm the contracting operator's exact legal name and legal constitution (proprietor/company/LLP).
- [ ] Insert complete business address, official monitored email, grievance contact and response process.
- [ ] Have an Indian technology/privacy lawyer review Terms, Privacy Policy, subscription/refund language, liability and jurisdiction.
- [ ] Map all data flows: website enquiry, accounts, desktop app, local DB, cloud sync, diagnostics, support, payments, backups and analytics.
- [ ] Publish actual hosting, messaging, payment and sub-processor list, locations and retention periods.
- [ ] Define when TRADEXO acts as Data Fiduciary and when it acts as Data Processor; prepare a Data Processing Agreement where appropriate.
- [ ] Implement notices, consent records, withdrawal, access/correction/erasure and grievance workflows as applicable.
- [ ] Implement least privilege, MFA for administrators, secure password hashing, encryption, secret management, patching, audit logs and tested backups.
- [ ] Never commit .env files, API keys, signing keys, production databases, customer invoices or personal data to GitHub. Rotate any exposed secret.
- [ ] Maintain a documented security incident/breach response plan, owners, evidence preservation and notification timelines.
- [ ] Test backup restoration and data deletion; define production and backup retention.
- [ ] Validate GST, e-invoice and e-way bill features against current official requirements and real portal/API integration. Do not claim government authentication unless a valid IRN/QR is received where required.
- [ ] Publish plan, renewal, cancellation, refund, support and complaint information before accepting payment.
- [ ] Obtain final written legal review before claiming TRADEXO is compliant or production-ready.

## Official references
- DPDP Act, 2023: https://www.indiacode.nic.in/indiacode/handle/123456789/22037?view_type=browse
- DPDP Rules, 2025: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- PIB summary of DPDP Rules and penalties (17 Nov 2025): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655&lang=2&reg=48
- IT Act, 2000: https://www.indiacode.nic.in/indiacode/handle/123456789/1999?locale=en
- CBIC GST invoice rules: https://cbic-gst.gov.in/gst-invoice-rules.html
- GSTN e-invoicing: https://www.gstn.org.in/e-invoicing

**Do not publish with placeholders.** These pages remain templates until operator identity, contacts, data flows and lawyer review are complete.
