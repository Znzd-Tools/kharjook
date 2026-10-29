'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_STORAGE_KEY = 'pwa-install-prompt-dismissed';

function readDismissedFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissedToStorage() {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    // Private mode / blocked storage — session dismiss still works.
  }
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isiOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|android|crios|fxios|edgios/i.test(ua);
}

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneMode());

  useEffect(() => {
    queueMicrotask(() => {
      setDismissed(readDismissedFromStorage());
      setStorageReady(true);
    });
  }, []);

  const dismissPermanently = () => {
    persistDismissedToStorage();
    setDismissed(true);
  };

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const showIosHint = useMemo(
    () => !isInstalled && !promptEvent && !dismissed && isiOS() && isSafari(),
    [dismissed, isInstalled, promptEvent]
  );

  const showInstall = !isInstalled && !dismissed && !!promptEvent;
  const showFallbackHint =
    !isInstalled && !dismissed && !promptEvent && !(isiOS() && isSafari());

  if (!storageReady) return null;
  if (!showInstall && !showIosHint && !showFallbackHint) return null;

  const hint = showInstall
    ? 'بدون نوار مرورگر، مثل یک اپ واقعی.'
    : showIosHint
      ? 'در Safari: Share ← Add to Home Screen'
      : 'از منوی مرورگر: Install app';

  return (
    <div className="px-4 pt-2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-raised py-2.5 pr-3 pl-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white">
          <Download size={17} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">خرجوک را نصب کن</p>
          <p className="truncate text-xs text-zinc-500">{hint}</p>
        </div>
        {showInstall && (
          <button
            type="button"
            onClick={async () => {
              if (!promptEvent) return;
              await promptEvent.prompt();
              const choice = await promptEvent.userChoice;
              setPromptEvent(null);
              if (choice.outcome !== 'accepted') {
                dismissPermanently();
              }
            }}
            className="h-8 shrink-0 rounded-full bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-900 hover:bg-white"
          >
            نصب
          </button>
        )}
        <button
          type="button"
          onClick={dismissPermanently}
          aria-label="بستن"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white/6 hover:text-zinc-200"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
