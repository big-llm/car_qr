# 🚗 Smart Vehicle Contact Platform (Monolithic)

A complete, production-ready solution for anonymous vehicle owner contact via QR codes. This platform bridges the physical and digital worlds, allowing civilians to alert car owners about parking obstructions, emergencies, or lights left on—all without exchanging phone numbers.

---

## 🏗️ System Architecture

This project is built as a **Monolithic Native Node.js App** (Vite + Express), designed for easy deployment to Vercel, Render, or a private VPS.

- **Frontend (`/frontend`)**: A 3-in-1 React Application:
  - **Public Scanner:** Mobile-first OTP-based alert trigger system with live response polling.
  - **Owner Portal:** Self-service fleet management and response center for car owners.
  - **Admin Panel:** Real-time monitoring of all alerts, scanners, and vehicle registrations.
- **Backend (`/backend`)**: A high-performance Express.js engine:
  - **Native Firebase Admin SDK:** Securely manages Firestore and Auth.
  - **JWT Authorization:** Dual-layer security for Admins and Owners.
  - **Internal Alert Processor:** Handles the logic of notifying owners and tracking scan history.

---

## 🚀 Key Features

### 1. **Zero-Friction Public Scanning**
- Scanners are verified via **Firebase SMS OTP** (powered by invisible reCaptcha) before alerts are sent, preventing spam.
- **Live Response Tracker:** Once an alert is sent, the scanner's screen polls the backend. When the owner hits "On my way!", the scanner sees it instantly.

### 2. **Mobile-First Owner Portal**
- Designed like a native mobile app with a bottom tab bar.
- Owners can register their plates and **Regenerate QR Tokens** instantly if a sticker is vandalized.
- One-tap responses: "On my way", "Acknowledged", or "In 5 minutes".

### 3. **Secure Admin Vault**
- **Full Transparency:** Admins see full, unmasked sender phone numbers for security audits.
- **Scanner Registry:** A dedicated database ledger of every person who has ever scanned a vehicle.
- **Bulk QR Generation:** Tools to print high-resolution SVG QR stickers for physical deployment.

---

## 🛠️ Deployment (Vercel Ready)

This repo is specifically hardened for Vercel. **Crucially**, it uses a "Cloud String" method so you don't have to upload your private keys to Git.

### Environment Variables Required:
1. **`FIREBASE_SERVICE_ACCOUNT`**: The entire contents of your Firebase `serviceAccountKey.json` pasted as a single string.
2. **`VITE_FIREBASE_API_KEY`**: Your Firebase Web API Key.
3. **`VITE_FIREBASE_PROJECT_ID`**: Your project ID (e.g., `smart-vehicle-contact-dev`).
4. **`ADMIN_USER`** & **`ADMIN_PASS`**: Your master admin credentials.

---

## 📂 Project Structure

```text
/
├── frontend/             # Vite + React Frontend (Scanner, Admin, Owner)
│   ├── src/
│   │   ├── App.tsx       # Scanner Interface
│   │   ├── AdminApp.tsx  # Super Admin Dashboard
│   │   └── OwnerApp.tsx  # Vehicle Owner Portal
├── backend/              # Express Backend (The "Live" API)
│   ├── src/
│   │   ├── server.ts     # Main Server Entry
│   │   ├── controllers/  # API Business Logic
│   │   └── services/     # Notification & Data Processors
├── .env                  # Local Keys (GitIgnored)
└── serviceAccountKey.json# Security Key (GitIgnored)
```

---

## ⚡ Quick Start

### 1. Build the Frontend
```bash
npm run build:frontend
```

### 2. Launch the Backend
```bash
npm run dev
```

The server will boot on `http://localhost:5000` and automatically serve the production build from the `/dist` folder.

---

## 🔒 Security
- Rate limiting on all public scan endpoints.
- SMS verification for all interactions.
- Cryptographic salt used for QR Token generation.
- Full `.gitignore` protection for sensitive local assets.
