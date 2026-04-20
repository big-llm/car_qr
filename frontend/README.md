# 🚗 Smart Vehicle Contact Platform

A modern, production-grade monolithic dashboard and QR scanning bridging platform integrating Vite, React, Express, Firebase Authentication, and Google Cloud Firestore.

## 🚀 Features at a Glance

### 1. **Public Scanner Hub (`/` or `/qr/:token`)**
- Secure invisible Google reCaptcha verifying scanners to prevent automated abuse.
- Full Firebase Phone Authentication (SMS OTP).
- Real-time **Live Status Polling**: After sending an alert, the scanner is instantly notified if the Owner taps "On my way!".
- Cryptographic Token matching (URL `token` natively maps to Firestore arrays ensuring owners remain totally anonymous to the scanner).

### 2. **Registered Owner Portal (`/owner`)**
- **Mobile-first design** with a bottom Tab-Bar layout for panicked or fast interactions.
- Allows Owners to see all printed QR codes actively registered to them.
- Push **1-button responses** directly back to scanners ("Acknowledge", "On my way", etc.).
- Regenerate keys natively (instantly blocking physically stolen/vandalized stickers).

### 3. **Super Admin Dashboard (`/admin`)**
- High-level bird's eye control viewing metrics for Total Scanners, Total Alerts, and Vehicles.
- **Scanners Ledger:** Complete, unmasked access to exactly which phone numbers are scanning vehicles and pushing alerts. Allows admins to visually verify abuse flags.
- **Physical QR Print Facility:** Dynamically generates SVG graphics representing vehicle tokens on the fly, prepared in a standard A4 print grid for physical offline deployment.

## 💻 Tech Stack
- Frontend: **React 18 + Vite** (`lucide-react`, `react-qr-code`)
- Backend Engine: **Express.js API** (integrated perfectly over exact Node port routing)
- Database: **Firebase Firestore**
- Identity Mapping: **Firebase Auth** (Dual integration through `firebase-admin` server-side JWT verification, and `firebase/auth` client-side auto-caching)

## 🛞 Setup Instructions

### Environment Variables
Due to GitHub tracking limitations and high security, `.env` and `serviceAccountKey.json` are strictly `.gitignore`'d. You MUST create a `.env` in your project root containing:
```env
VITE_FIREBASE_API_KEY=your_web_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=smart-vehicle-contact-dev
ADMIN_USER=admin
ADMIN_PASS=password123
```

Ensure `serviceAccountKey.json` from the Google SDK is physically sitting in the root folder alongside the `.env`.

### Booting the Monolith
Simply run these concurrently or in sequentially:

**Terminal 1 (Build the App dynamically):**
```bash
cd scanner-app
npm install
npm run build
```

**Terminal 2 (Launch the Express Node API):**
```bash
cd functions
npm install
npm run dev
```

Navigate to `http://localhost:5000` to interact with the platform natively!
