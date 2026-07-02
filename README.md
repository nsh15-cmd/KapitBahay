<div align="center">

# 🏘️ KapitBahay
**Decentralized, Offline-First Disaster Resilience Mesh**

<!-- Core -->
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google-gemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Ditto](https://img.shields.io/badge/Ditto_SDK-4A4AFF?style=for-the-badge)](https://www.ditto.live/)

<!-- Mobile -->
[![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://developer.android.com/)
[![Android Studio](https://img.shields.io/badge/Android_Studio-3DDC84?style=for-the-badge&logo=androidstudio&logoColor=white)](https://developer.android.com/studio)
[![PWA](https://img.shields.io/badge/Progressive_Web_App-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

<!-- Maps -->
[![MapLibre](https://img.shields.io/badge/MapLibre-396CB2?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Carto](https://img.shields.io/badge/CARTO-EB1510?style=for-the-badge&logo=carto&logoColor=white)](https://carto.com/)
[![OSRM](https://img.shields.io/badge/OSRM-Routing-4CAF50?style=for-the-badge)](https://project-osrm.org/)

<!-- Storage -->
[![IndexedDB](https://img.shields.io/badge/IndexedDB-003B57?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![Zustand](https://img.shields.io/badge/Zustand-764ABC?style=for-the-badge)](https://zustand-demo.pmnd.rs/)

<!-- Communication -->
[![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![Bluetooth LE](https://img.shields.io/badge/Bluetooth_LE-0082FC?style=for-the-badge&logo=bluetooth&logoColor=white)](https://www.bluetooth.com/)
[![AES-256](https://img.shields.io/badge/AES--256_GCM-Security-red?style=for-the-badge)]
[![Web Crypto API](https://img.shields.io/badge/Web_Crypto_API-4285F4?style=for-the-badge)]

<!-- UI -->
[![Lucide](https://img.shields.io/badge/Lucide_Icons-F56565?style=for-the-badge)](https://lucide.dev/)

> 🏆 **Developed for Sparkfest 2026**  
> *Aligned with UN Sustainable Development Goals: SDG 9 (Infrastructure Resilience) & SDG 11 (Sustainable Communities).*

</div>

---

# 📖 Project Brief

**KapitBahay** is a decentralized, offline-first native mobile platform and Progressive Web App (PWA) designed to safeguard communities during total grid collapses. Using a hybrid React architecture and the Ditto SDK, it establishes an elastic peer-to-peer (P2P) mesh network using ordinary consumer smartphones. It enables crowdsourced hazard reporting, AI-driven disaster triage, and localized mutual aid entirely without cellular data—instantly bridging to a central cloud dashboard the moment fleeting connectivity returns.

---

# 🚨 The Problem

During severe typhoons and cascading natural disasters in the Philippines, national power grids and telecommunication networks frequently fail. When cell towers deplete their backup batteries and local internet routers die, communities are left in a total connectivity blackout exactly when medical evacuations, hazard reporting, and relief coordination are most critical.

Traditional emergency management applications fail under these conditions because they depend strictly on continuous 4G/5G/Wi-Fi cloud connectivity.

---

# 💡 The Solution

**KapitBahay** bypasses downed infrastructure entirely. It turns ordinary consumer smartphones into an elastic peer-to-peer mesh network, allowing survival intelligence to jump directly from phone to phone.

## ✨ Core Features

- 📵 **Zero-Internet P2P Mesh Network**  
  Devices discover each other locally using LAN, WebRTC, and background multi-hop Bluetooth Low Energy (BLE) to securely replicate incident databases over the air.

- 🧠 **Cognitive AI Incident Triage**  
  Automatically scans crowdsourced reports, calculates severity scores (1–100), assigns priority tiers, and recommends dispatch units.

- 🔐 **Secure Cryptography**  
  All peer-to-peer payloads are encrypted locally using AES-256-GCM before transmission.

- 🗺️ **Resilient GIS Mapping**  
  Captures raw hardware GPS coordinates offline, featuring offline-capable raster tiles and an integrated OSRM routing engine to calculate foot distances to evacuation zones.

- ☁️ **Intermittent Cloud Bridge**  
  Reports are queued locally during blackouts. A background daemon bridges the aggregated dataset to Firebase the second any mesh node connects to the internet.

---

# 🛠️ Comprehensive Technology Stack

## 📡 Offline P2P Mesh Engine

- **Ditto SDK (`@dittolive/ditto`)**
  - Core decentralized P2P mesh framework
  - Automatic peer discovery
  - Conflict-free data replication
  - LAN synchronization

- **WebRTC**
  - Browser-to-browser synchronization
  - Peer communication layer

- **Bluetooth Low Energy (BLE)**
  - Background device discovery
  - Offline mesh communication

- **Web Crypto API**
  - PBKDF2 key derivation
  - AES-256-GCM encryption
  - Secure payload protection

---

## 📱 Native Mobile & Hardware Layer

- **Android Studio**
  - Native Android development
  - Debugging
  - APK generation

- **Capacitor**
  - JavaScript-to-native bridge
  - Android runtime
  - Hardware access

- **Java / Kotlin Native Bridges**
  - Background services
  - BLE listeners
  - Native APIs

- **Progressive Web App (PWA)**
  - Installable application
  - Offline caching
  - Service Worker support
  - `virtual:pwa-register`

---

## ☁️ Cloud & AI Integration

### Google Gemini AI

- Intelligent disaster triage
- Severity scoring
- Incident summarization
- Emergency response recommendations

### Firebase

#### Firestore

- Cloud synchronization
- Real-time database
- Centralized reporting

#### Firebase Authentication

- Google Sign-In
- Citizen authentication
- LGU access
- Administrator accounts

---

## 💻 Frontend & UI

- **React**
  - Component architecture
  - Hooks
  - Modern SPA

- **TypeScript**
  - Type safety
  - Maintainable codebase

- **Vite**
  - Fast development server
  - Lightning-fast builds

- **Tailwind CSS**
  - Utility-first styling
  - Responsive design
  - Dark mode support

- **Lucide React**
  - Modern SVG icons

---

## 🗄️ State Management & Local Storage

### IndexedDB (`idb`)

- Offline storage
- Local disaster reports
- Queue management

### Zustand

- Lightweight state management
- Global application state
- Mesh synchronization

---

## 🗺️ Geographic Information Systems (GIS)

### MapLibre GL

- Interactive maps
- Offline vector rendering
- Cached map layers

### CartoDB

- Basemap provider
- Geographic visualization

### OSRM (Open Source Routing Machine)

- Walking routes
- Distance calculations
- Evacuation guidance

---

# 👥 Meet the Team

**Team Name:** *[Your Team Name Here]*

| Name | Role |
|------|------|
| **Renz Jericho Buday** | Lead Developer / Systems Architect |
| **[Member Name]** | UI/UX Designer |
| **[Member Name]** | AI & Backend Integration |
| **[Member Name]** | Pitch & Research |

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/your-username/KapitBahay.git
cd KapitBahay
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file in the project root.

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_GEMINI_API_KEY=your_gemini_key

VITE_DITTO_APP_ID=your_ditto_app_id
```

---

## 4. Start the Development Server

```bash
npm run dev
```

The application will be available at:

```
http://localhost:5173
```

---

## 5. Build for Production

```bash
npm run build
```

---

## 6. Build Android APK (Optional)

```bash
npm run build
npx cap sync android
npx cap open android
```

Build and generate the APK directly through **Android Studio**.

---

# 📦 Project Highlights

- 🌐 Offline-first architecture
- 📱 Progressive Web App (PWA)
- 🤖 AI-powered disaster assessment
- 📡 Peer-to-peer mesh networking
- 🔒 AES-256 encrypted communication
- 🗺️ Offline GIS mapping
- ☁️ Automatic cloud synchronization
- 📲 Android APK support
- ⚡ Fast React + Vite architecture

---

<div align="center">

### ❤️ Building resilient communities through decentralized technology.

**KapitBahay — Connecting Neighbors When the Grid Goes Dark.**

</div>
