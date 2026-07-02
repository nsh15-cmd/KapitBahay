// C:\Users\Renz Jericho Buday\KapitBahay\src\main.tsx
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

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

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
};

if (Capacitor.getPlatform() !== 'web') {
  CapacitorApp.addListener('appUrlOpen', async (event: { url?: string }) => {
    if (event.url) {
      console.log('📲 App opened via URL:', event.url);
      window.location.href = event.url;
    }
  });
}

renderApp();