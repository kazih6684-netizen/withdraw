import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALLED_STORAGE_KEY = 'unity_pwa_installed';

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function getPersistedInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export type BrowserInstallPlatform = 'ios' | 'chrome' | 'samsung' | 'edge' | 'firefox' | 'other';

function detectBrowserPlatform(): BrowserInstallPlatform {
  if (typeof window === 'undefined') return 'other';
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/samsungbrowser/.test(ua)) return 'samsung';
  if (/edg/.test(ua)) return 'edge';
  if (/firefox|fxios/.test(ua)) return 'firefox';
  if (/chrome|crios|chromium/.test(ua)) return 'chrome';
  return 'other';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__deferredPWAPrompt) {
      return window.__deferredPWAPrompt as BeforeInstallPromptEvent;
    }
    return null;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (checkIsStandalone()) return true;
    // If browser already fired beforeinstallprompt, app is not currently installed
    if (typeof window !== 'undefined' && window.__deferredPWAPrompt) return false;
    return getPersistedInstalled();
  });

  const [browserPlatform, setBrowserPlatform] = useState<BrowserInstallPlatform>(() =>
    detectBrowserPlatform()
  );

  useEffect(() => {
    setBrowserPlatform(detectBrowserPlatform());

    const standaloneNow = checkIsStandalone();
    if (standaloneNow) {
      setIsInstalled(true);
      try {
        localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
    }

    if (window.__deferredPWAPrompt) {
      setDeferredPrompt(window.__deferredPWAPrompt as BeforeInstallPromptEvent);
      if (!standaloneNow) {
        setIsInstalled(false);
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__deferredPWAPrompt = e;
      try {
        localStorage.removeItem(INSTALLED_STORAGE_KEY);
      } catch {
        // ignore
      }
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstalled(checkIsStandalone());
    };

    const handleAppInstalled = () => {
      window.__deferredPWAPrompt = null;
      try {
        localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        handleAppInstalled();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEvent =
      deferredPrompt || (window.__deferredPWAPrompt as BeforeInstallPromptEvent | null);

    if (!promptEvent) {
      return 'unavailable';
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      window.__deferredPWAPrompt = null;
      setDeferredPrompt(null);

      if (outcome === 'accepted') {
        try {
          localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
        } catch {
          // ignore
        }
        setIsInstalled(true);
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.error('PWA install prompt error:', err);
      return 'unavailable';
    }
  }, [deferredPrompt]);

  const markAsInstalled = useCallback(() => {
    window.__deferredPWAPrompt = null;
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setDeferredPrompt(null);
    setIsInstalled(true);
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS: browserPlatform === 'ios',
    browserPlatform,
    install,
    markAsInstalled,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
