# BIZORA Owner Admin — setup status

## Implemented
- Owner console route: `/admin`
- Supabase email/password sign-in
- Frontend rejects accounts unless `app_metadata.role = owner_admin`
- Customer, enquiry, payment, license and audit-log views
- Database tables with RLS policies restricted to the Owner Admin claim
- No public sign-up flow in the admin interface

## Supabase project
- Project: BIZORA
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
- Admin list views currently display records and basic dashboard counts; record editing, payment verification workflows, license activation/renewal actions, and automatic audit event writing are not implemented yet.
- The website's existing enquiry form still opens a WhatsApp draft; it does not yet insert enquiries into the database.
- Supabase Auth user provisioning is not automated.
- Before production customer data is entered, add server-side audited actions for payment verification and license changes.
