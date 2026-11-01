# Security baseline

- Do not commit `.env`, credentials, signing certificates, customer records or production databases.
- Use server-side authorization for admin and license operations; hiding a button is not security.
- Store password hashes using a modern password hashing algorithm on the backend; never store plaintext passwords or PINs.
- Apply least-privilege roles and record admin actions in an append-only audit log.
- Customer records should not have a delete control; support inactive, suspended and archived states.
- Validate and sanitize all user input on both client and server.
- Use HTTPS for all production API traffic.
- Electron renderer must not have Node integration. Expose only narrow, validated IPC methods through preload.
- Verify signed update packages before installation. Back up user data before updating and provide tested rollback.
- Offline license cache must be tamper-resistant and have a defined expiry/grace policy. Do not hard-code a master license key in the app.
- Provide data export and backup independent of paid-plan gating.
