# TRADEXO — Project 521

**One Business. One System. Complete Control.**  
A product by **FIXBYTE INDIA**.

This is the initial GitHub-ready starter workspace for TRADEXO. It contains:
- `website/` — public product website (React + Vite)
- `desktop/` — Windows desktop shell (Electron + React + Vite)
- `docs/` — product requirements, roadmap, security and setup notes

> Important: This is Phase 1 foundation code, not a finished ERP. Billing, GST calculations, inventory transactions, cloud licensing, admin activation, signed auto-updates, and backup/restore must be implemented and tested in later phases before real business use.

## Requirements
- Windows 10/11
- Node.js 20 LTS or newer
- Git
- VS Code

## Start website
```powershell
cd website
npm install
npm run dev
```
Open the local URL shown by Vite (usually http://localhost:5173).

## Start desktop app
```powershell
cd desktop
npm install
npm run dev
```

## Build Windows installer (later, after testing)
```powershell
cd desktop
npm run build:win
```

## GitHub upload
1. Create a new **private** GitHub repository named `TRADEXO`.
2. Extract this ZIP.
3. Open the extracted `TRADEXO-Project-521` folder in VS Code.
4. Run:
```powershell
git init
git add .
git commit -m "Start TRADEXO Project 521"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/TRADEXO.git
git push -u origin main
```
Replace `YOUR-USERNAME` with your GitHub username.

Never upload passwords, API keys, customer data, real invoices, or production database files.
