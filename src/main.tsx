import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Capture beforeinstallprompt globally before React finishes mounting
declare global {
  interface Window {
    __deferredPWAPrompt?: Event | null;
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredPWAPrompt = e;
  // Clear stored installed flag if browser offers install prompt again (e.g. app was uninstalled)
  try {
    localStorage.removeItem('unity_pwa_installed');
  } catch {
    // ignore storage errors
  }
});

window.addEventListener('appinstalled', () => {
  window.__deferredPWAPrompt = null;
  try {
    localStorage.setItem('unity_pwa_installed', 'true');
  } catch {
    // ignore storage errors
  }
});

registerSW({immediate: true});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
