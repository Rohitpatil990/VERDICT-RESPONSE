# VERDICT Setup & Deployment Guide

## 1. System Requirements
- Node.js ≥ 20.0.0 (Tested on Node.js v24)
- npm ≥ 10.0.0
- Any modern web browser (Chrome, Firefox, Safari, Edge)

## 2. One-Command Installation & Build

```bash
# Clone or extract repository
cd Final_PrintWinners

# Install dependencies for all workspaces
npm install

# Build all TypeScript packages (core, region-service, web)
npm run build

# Safe demo reset: Back up old database state and seed fresh generic disaster scenario
node scripts/backup-and-reset.js
npm run seed
```

## 2.1 Automated Tests & Verification

```bash
# Run core and region-service tests
npm test

# Run regional database failure and local standby recovery simulation
node scripts/test-regional-loss-and-recovery.js

# Run full end-to-end verification
npm run verify
```

## 3. Running All Services Locally

```bash
# Starts 3 regional nodes + web console concurrently
npm run dev:local
```

Access the following endpoints:
- **Web Operations Console:** `http://localhost:3000`
- **Mumbai Node REST/SSE:** `http://localhost:4001` (Authority)
- **Delhi Node REST/SSE:** `http://localhost:4002`
- **Bengaluru Node REST/SSE:** `http://localhost:4003`
- **OpenAPI Interactive Docs:** `http://localhost:4001/docs`

## 4. Running the 3-Minute Automated Demo

Ensure `npm run dev:local` is running in one terminal, then in another terminal execute:

```bash
npm run demo
```

Or click the **"Run 3-Min Demo"** button directly in the web console top navigation bar.

## 5. Mobile Device Access via LAN / HTTPS

To test the mobile-first Field reporting interface from a smartphone on the local Wi-Fi:

1. Determine your computer's local LAN IP:
   - Windows: `ipconfig` (e.g. `192.168.1.100`)
2. Start Vite with host binding:
   ```bash
   npx vite --host 0.0.0.0 --port 3000
   ```
3. Open `http://<YOUR_IP>:3000` on your mobile phone browser.
4. For GPS geolocation APIs requiring secure contexts, modern browsers allow geolocation on `localhost` or via self-signed SSL/tunnel (e.g. `ngrok http 3000` or `mkcert`).
