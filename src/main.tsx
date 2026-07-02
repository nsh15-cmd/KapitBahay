// C:\Users\Renz Jericho Buday\KapitBahay\src\main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Import the PWA virtual register
import { registerSW } from 'virtual:pwa-register';

// Register the service worker to make the app work offline
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new system update for KapitBahay is available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('✅ PWA cached successfully. KapitBahay is now ready to work offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);