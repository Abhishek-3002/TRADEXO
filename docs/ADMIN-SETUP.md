# TRADEXO Owner Admin — setup status

## Implemented
- Owner console route: `/admin`
- Supabase email/password sign-in
- Frontend rejects accounts unless `app_metadata.role = owner_admin`
- Customer, enquiry, payment, license and audit-log views (latest 100 records per section)
- Database tables with RLS policies restricted to the trusted Owner Admin app_metadata claim
- Payment verification RPC accepts only pending INR payments matching ₹1,499 / ₹4,999 / ₹9,999 annual plan prices; it atomically verifies payment, creates or renews the customer's license, updates the customer plan and writes an audit event
- License suspend/reactivate RPC with Owner Admin authorization and audit logging
- License device limit stored with each license (default 1; allowed range 1–20)
- No customer deletion action and no public sign-up flow in the admin interface

## Supabase project
- Project: TRADEXO
- Region: ap-south-1 (Mumbai)
- Project ref: `nelunfokvvlgujmjbiaj`

## Vercel environment
Set these for Production, Preview and Development:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never put a Supabase service-role key in Vite/Vercel public environment variables or browser code.

## First Owner Admin account — manual secure provisioning required
1. Owner supplies the email address they control.
2. Create/invite that user in Supabase Auth (do not enable public signup).
3. Set the user's trusted `app_metadata` claim to `{"role":"owner_admin"}` using the Supabase Dashboard or a trusted server-side admin operation.
4. Do not set the role in `user_metadata`; users can edit that field.
5. Sign in at `/admin` and confirm the Owner Console opens.
6. Verify a normal authenticated account without the claim is denied.

Do not share passwords in chat. The owner should set their own password through the secure Supabase invite/recovery flow.

## Current limitations
- Customer profile editing, customer registration/self-service portal and automated payment gateway verification are not implemented.
- The website's enquiry form still opens a WhatsApp draft; it does not yet insert enquiries into the database.
- Supabase Auth user provisioning and role assignment remain manual and must be performed by a trusted owner process.
- The current admin workflow manually verifies the payment record entered by an authorised operator; it does not independently confirm UPI/bank settlement.
- Desktop license-key validation, device binding enforcement, offline grace period and signed updater integration remain to be completed and tested before commercial release.
