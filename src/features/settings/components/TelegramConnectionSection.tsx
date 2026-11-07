'use client';

import { IconBadge } from '@/shared/components/ui';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Link2, Unlink } from 'lucide-react';
import { useToast } from '@/shared/components/Toast';
import type { TelegramConnection } from '@/shared/types/domain';

export function TelegramConnectionSection() {
  const toast = useToast();
  const [connection, setConnection] = useState<TelegramConnection | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const loadConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/telegram/connection');
      if (!res.ok) throw new Error('load failed');
      const json = (await res.json()) as { connection: TelegramConnection | null };
      setConnection(json.connection);
    } catch {
      toast.error('خطا در دریافت وضعیت تلگرام.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  const handleConnect = async () => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' });
      const json = (await res.json()) as { linkUrl?: string; error?: string };
      if (!res.ok || !json.linkUrl) {
        throw new Error(json.error ?? 'link failed');
      }
      setLinkUrl(json.linkUrl);
      window.open(json.linkUrl, '_blank', 'noopener,noreferrer');
      toast.success('لینک اتصال ساخته شد. در تلگرام «Start» را بزنید.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ساخت لینک.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/telegram/connection', { method: 'POST' });
      if (!res.ok) throw new Error('disconnect failed');
      setConnection(null);
      setLinkUrl(null);
      toast.success('اتصال تلگرام قطع شد.');
    } catch {
      toast.error('خطا در قطع اتصال.');
    } finally {
      setIsBusy(false);
    }
  };

  const connected = connection?.is_active !== false && !!connection;

  const pill =
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors disabled:opacity-50';

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <IconBadge color="#38bdf8">
          <Link2 size={17} strokeWidth={1.9} />
        </IconBadge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">تلگرام</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {isLoading ? (
              'در حال بارگذاری...'
            ) : connected ? (
              <>
                <span className="text-emerald-400">متصل</span>
                {connection.telegram_username ? <span dir="ltr"> · @{connection.telegram_username}</span> : null}
              </>
            ) : (
              'گزارش، یادآور اقساط و ثبت سریع در تلگرام'
            )}
          </p>
        </div>
        {!isLoading &&
          (connected ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleDisconnect()}
              className={`${pill} text-rose-400 hover:bg-rose-500/10`}
            >
              <Unlink size={14} />
              قطع
            </button>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleConnect()}
              className={`${pill} bg-zinc-50 text-zinc-900 hover:bg-white`}
            >
              <ExternalLink size={14} />
              اتصال
            </button>
          ))}
      </div>
      {!connected && linkUrl ? (
        <p className="mt-2 break-all pr-13 text-xs text-zinc-500" dir="ltr">
          {linkUrl}
        </p>
      ) : null}
    </div>
  );
}
