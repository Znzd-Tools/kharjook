'use client';

/**
 * Settings → اتصال به Claude. Make / revoke the secret connector URL and see
 * the last changes Claude made through it.
 */
import { useCallback, useEffect, useState } from 'react';
import { Banner, Button, List, ListRow, Section, Skeleton, Text, TopBar, toast, useConfirm } from '@/design-system';
import { CheckCircle2, Copy, XCircle } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { formatJalaali, jalaaliOfDate } from '@/shared/utils/jalali';

interface Status {
  active: boolean;
  created_at: string | null;
  last_used_at: string | null;
  log: { id: string; tool: string; ok: boolean; summary: string | null; created_at: string }[];
}

const when = (iso: string | null) => {
  if (!iso) return 'هنوز نه';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' });
  return `${formatJalaali(jalaaliOfDate(d))} ${time}`;
};

export function McpSettingsView() {
  const back = useSafeBack('/settings');
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/mcp/token');
    if (r.ok) setStatus((await r.json()) as Status);
  }, []);
  useEffect(() => {
    let live = true;
    fetch('/api/mcp/token')
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : null))
      .then((s) => live && s && setStatus(s))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const create = async () => {
    if (status?.active) {
      const ok = await confirm({
        title: 'آدرس جدید بسازم؟',
        description: 'آدرس قبلی دیگر کار نمی‌کند و باید آدرس جدید را در Claude بگذاری.',
        confirmLabel: 'آدرس جدید',
      });
      if (!ok) return;
    }
    setBusy(true);
    const r = await fetch('/api/mcp/token', { method: 'POST' });
    setBusy(false);
    if (!r.ok) return toast.error('ساخت آدرس نشد');
    const { token } = (await r.json()) as { token: string };
    setUrl(`${window.location.origin}/api/mcp?key=${token}`);
    void load();
  };

  const revoke = async () => {
    const ok = await confirm({ title: 'اتصال Claude قطع شود؟', confirmLabel: 'قطع اتصال', tone: 'danger' });
    if (!ok) return;
    await fetch('/api/mcp/token', { method: 'DELETE' });
    setUrl(null);
    toast.success('اتصال قطع شد');
    void load();
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    toast.success('کپی شد');
  };

  return (
    <div className="min-h-full bg-canvas pb-24">
      <TopBar onBack={back} title="اتصال به Claude" />
      <div className="space-y-6 px-(--ds-gutter) pt-2">
        <Text variant="callout" tone="muted">
          با این آدرس، Claude دفترت را می‌خواند (دارایی، سود، تراکنش‌ها، سررسیدها) و به درخواست تو تراکنش ثبت یا ویرایش می‌کند. هر تغییر پایین همین صفحه ثبت می‌شود.
        </Text>

        {!status ? (
          <Skeleton className="h-24 rounded-card" />
        ) : (
          <Section title="آدرس اتصال">
            <div className="space-y-3 rounded-card bg-panel p-4">
              <div className="flex items-center gap-2">
                {status.active ? <CheckCircle2 className="size-5 text-positive-ink" /> : <XCircle className="size-5 text-fg-subtle" />}
                <Text variant="callout" className="font-medium">
                  {status.active ? 'فعال' : 'غیرفعال'}
                </Text>
                {status.active && (
                  <Text variant="caption" tone="subtle" className="ms-auto">
                    آخرین استفاده: {when(status.last_used_at)}
                  </Text>
                )}
              </div>

              {url && (
                <>
                  <Banner tone="warning" title="این آدرس مثل رمز است">
                    فقط همین یک بار نشان داده می‌شود. آن را به کسی نده.
                  </Banner>
                  <button
                    type="button"
                    onClick={copy}
                    className="flex w-full items-center gap-2 rounded-control bg-sunken p-3 text-start"
                    aria-label="کپی آدرس"
                  >
                    <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-caption text-fg">
                      {url}
                    </span>
                    <Copy className="size-5 shrink-0 text-fg-muted" />
                  </button>
                </>
              )}

              <div className="flex gap-2">
                <Button className="min-w-0 flex-1" loading={busy} onClick={create}>
                  {status.active ? 'آدرس جدید' : 'ساخت آدرس'}
                </Button>
                {status.active && (
                  <Button variant="danger" onClick={revoke}>
                    قطع اتصال
                  </Button>
                )}
              </div>
            </div>
          </Section>
        )}

        <Section title="راه‌اندازی در Claude">
          <ol className="list-decimal space-y-1 rounded-card bg-panel p-4 ps-8 text-callout text-fg-muted">
            <li>در claude.ai برو به Settings ← Connectors.</li>
            <li>«Add custom connector» را بزن.</li>
            <li>نام: خرجوک. آدرس: همان آدرس بالا. ذخیره کن.</li>
            <li>در گفتگو از منوی ابزارها، خرجوک را روشن کن.</li>
          </ol>
        </Section>

        {status && status.log.length > 0 && (
          <Section title="آخرین تغییرها">
            <List>
              {status.log.map((l) => (
                <ListRow
                  key={l.id}
                  size="sm"
                  leading={l.ok ? <CheckCircle2 className="size-5 text-positive-ink" /> : <XCircle className="size-5 text-negative-ink" />}
                  title={<span dir="ltr">{l.summary ?? l.tool}</span>}
                  subtitle={`${l.tool} · ${when(l.created_at)}`}
                />
              ))}
            </List>
          </Section>
        )}
      </div>
    </div>
  );
}
