'use client';

import { useRouter } from 'next/navigation';
import { Section, Switch, toast } from '@/design-system';
import { FLAGS, type FlagName } from '@/shared/lib/flags/flags';
import { useFlags } from '@/shared/lib/flags/client';

/**
 * Turn each v2 area on or off. Off = the old screen comes back. Safety
 * valve for the UX v2 rollout.
 */
export function LabsSettingsSection() {
  const router = useRouter();
  const { flags, setFlag } = useFlags();
  return (
    <Section title="آزمایشی" description="اگر بخشی از نسخه جدید مشکل داشت، خاموشش کن تا نسخه قبلی برگردد.">
      <div className="space-y-4 rounded-card bg-panel p-4">
        {(Object.keys(FLAGS) as FlagName[]).map((name) => (
          <Switch
            key={name}
            label={FLAGS[name].label}
            checked={flags[name]}
            onCheckedChange={(on) => {
              setFlag(name, on);
              router.refresh();
              toast.show(on ? 'نسخه جدید روشن شد' : 'نسخه قبلی برگشت');
            }}
          />
        ))}
      </div>
    </Section>
  );
}
