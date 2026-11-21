'use client';

import { Banner, Button } from '@/design-system';
import { useEffect, useMemo, useState } from 'react';

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

  return (
    <div className="px-(--ds-gutter) pt-3">
      <Banner
        tone="accent"
        title="نصب اپ"
        onDismiss={dismissPermanently}
        action={
          showInstall ? (
            <Button
              size="sm"
              onClick={async () => {
                if (!promptEvent) return;
                await promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                setPromptEvent(null);
                if (choice.outcome !== 'accepted') dismissPermanently();
              }}
            >
              نصب
            </Button>
          ) : undefined
        }
      >
        {showInstall
          ? 'خرجوک را روی صفحه‌ی اصلی نصب کن تا مثل اپ باز شود.'
          : showIosHint
            ? 'در آیفون: Safari ← Share ← Add to Home Screen'
            : 'از منوی مرورگر «Install app» یا «Add to Home Screen» را بزن.'}
      </Banner>
    </div>
  );
}
