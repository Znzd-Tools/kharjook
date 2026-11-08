'use client';

import { useEffect, useState } from 'react';
import { Banner, Button, Disclosure, Input, Section, Text, toast, useConfirm } from '@/design-system';
import { Copy } from '@/design-system/icons';

/**
 * Settings → ثبت خودکار پیامک بانکی. Makes a personal webhook URL for a
 * phone forwarder app. The token is shown once; a new one stops the old.
 */
export function SmsSettingsSection() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<{ active: boolean; last_used_at?: string | null } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/sms/token')
      .then((r) => (r.ok ? r.json() : { active: false }))
      .then(setStatus)
      .catch(() => setStatus({ active: false }));
  }, []);

  const create = async () => {
    if (status?.active) {
      const ok = await confirm({
        title: 'آدرس تازه ساخته شود؟',
        description: 'آدرس قبلی دیگر کار نمی‌کند و باید آدرس تازه را در برنامه ارسال پیامک بگذاری.',
        confirmLabel: 'ساختن',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/sms/token', { method: 'POST' });
      const json = (await res.json()) as { token?: string };
      if (!res.ok || !json.token) throw new Error();
      setUrl(`${window.location.origin}/api/sms/ingest?token=${json.token}`);
      setStatus({ active: true, last_used_at: null });
    } catch {
      toast.error('ساخت آدرس انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    const ok = await confirm({ title: 'ثبت خودکار پیامک خاموش شود؟', confirmLabel: 'خاموش کن', tone: 'danger' });
    if (!ok) return;
    await fetch('/api/sms/token', { method: 'DELETE' });
    setUrl(null);
    setStatus({ active: false });
    toast.show('ثبت خودکار پیامک خاموش شد');
  };

  return (
    <Section
      id="sms"
      title="ثبت خودکار پیامک بانکی"
      description="پیامک‌های بانک خودکار به «تراکنش‌ها» می‌آیند. تو فقط تأیید می‌کنی. پیامک رمز و کد هرگز ذخیره نمی‌شود."
    >
      <div className="space-y-3 rounded-card bg-panel p-4">
        {url ? (
          <>
            <Banner tone="info" title="این آدرس را فقط یک بار می‌بینی">
              آن را در برنامه ارسال پیامک بگذار. آدرس مثل رمز است؛ به کسی نده.
            </Banner>
            <Input aria-label="آدرس ارسال پیامک" value={url} readOnly dir="ltr" onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()} />
            <Button
              fullWidth
              variant="soft"
              startIcon={<Copy />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success('کپی شد'))
                  .catch(() => toast.error('کپی نشد؛ دستی انتخاب کن'))
              }
            >
              کپی آدرس
            </Button>
          </>
        ) : (
          <Text variant="callout" tone={status?.active ? 'default' : 'muted'}>
            {status === null
              ? '…'
              : status.active
                ? `روشن است${status.last_used_at ? ` · آخرین پیامک: ${new Date(status.last_used_at).toLocaleString('fa-IR')}` : ' · هنوز پیامکی نرسیده'}`
                : 'خاموش است'}
          </Text>
        )}
        <div className="flex gap-2">
          <Button loading={busy} onClick={() => void create()}>
            {status?.active ? 'ساخت آدرس تازه' : 'روشن کردن'}
          </Button>
          {status?.active && (
            <Button variant="ghost" className="text-negative-ink" onClick={() => void stop()}>
              خاموش کردن
            </Button>
          )}
        </div>
        <Disclosure title="راهنمای نصب روی اندروید">
          <ol className="list-decimal space-y-1.5 ps-5 text-caption text-fg-muted">
            <li>یک برنامه ارسال پیامک به وب‌هوک نصب کن (مثلاً «SMS Forwarder» یا قانون MacroDroid/Tasker).</li>
            <li>یک قانون بساز: فرستنده = بانک‌های تو (یا همه پیامک‌ها).</li>
            <li>مقصد: Webhook / URL، روش POST، و آدرس بالا. بدنه: JSON با کلید «text» و «from» (بیشتر برنامه‌ها خودشان این را دارند).</li>
            <li>یک پیامک آزمایشی بفرست؛ باید در «تراکنش‌ها» بیاید.</li>
          </ol>
          <p className="mt-2 text-caption text-fg-subtle">
            در iPhone خواندن پیامک برای هیچ برنامه‌ای مجاز نیست. با Shortcuts → Automation → Message می‌شود متن را به همین آدرس فرستاد.
          </p>
        </Disclosure>
      </div>
    </Section>
  );
}
