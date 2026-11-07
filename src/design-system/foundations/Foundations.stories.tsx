import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpLeft, Banknote, BarChart3, Bell, CalendarDays, ChevronLeft, CircleDollarSign,
  Coins, CreditCard, FileText, Home, Landmark, MoreHorizontal, PieChart, Plus, Receipt, Repeat, Search, Settings,
  Target, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { colorGroups, motion, radii, shadows, spacing, typeScale } from './tokens';

const meta: Meta = { title: 'Foundations', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const Page = ({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) => (
  <div className="mx-auto max-w-3xl space-y-8 p-6">
    <header className="space-y-1">
      <h1 className="text-headline text-fg">{title}</h1>
      <p className="text-callout text-fg-muted">{intro}</p>
    </header>
    {children}
  </div>
);

export const Colors: Story = {
  render: () => (
    <Page title="رنگ‌ها" intro="Semantic tokens only. Switch the theme in the toolbar to see light and dark values. Class names: bg-{token}, text-{token}, border-{token}.">
      {colorGroups.map((g) => (
        <section key={g.name} className="space-y-3">
          <div>
            <h2 className="text-title text-fg" dir="ltr">{g.name}</h2>
            <p className="text-caption text-fg-subtle" dir="ltr">{g.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {g.tokens.map((t) => (
              <div key={t.name} className="overflow-hidden rounded-card border border-line bg-panel">
                <div className="h-16 border-b border-line" style={{ background: `var(--color-${t.name})` }} />
                <div className="space-y-0.5 p-3" dir="ltr">
                  <p className="font-mono text-caption text-fg">{t.name}</p>
                  <p className="text-micro text-fg-subtle">{t.use}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="space-y-3">
        <h2 className="text-title text-fg" dir="ltr">Pairings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-card bg-panel p-4"><p className="text-body text-fg">fg on panel</p><p className="text-caption text-fg-muted">fg-muted on panel</p><p className="text-caption text-fg-subtle">fg-subtle on panel</p></div>
          <div className="rounded-card bg-accent p-4 text-fg-on-accent">fg-on-accent on accent</div>
          <div className="rounded-card bg-positive-soft p-4 text-positive-ink">positive-ink on positive-soft</div>
          <div className="rounded-card bg-negative-soft p-4 text-negative-ink">negative-ink on negative-soft</div>
          <div className="rounded-card bg-warning-soft p-4 text-warning-ink">warning-ink on warning-soft</div>
          <div className="rounded-card bg-accent-soft p-4 text-accent-ink">accent-ink on accent-soft</div>
        </div>
      </section>
    </Page>
  ),
};

export const Typography: Story = {
  render: () => (
    <Page title="تایپوگرافی" intro="IRANSansX, 7 sizes. Use the Text component or text-{name}. Weight comes with the size token; override only with font-medium/semibold.">
      <div className="divide-y divide-line overflow-hidden rounded-card bg-panel">
        {typeScale.map((t) => (
          <div key={t.name} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6">
            <div className="w-40 shrink-0" dir="ltr">
              <p className="font-mono text-caption text-fg">text-{t.name}</p>
              <p className="text-micro text-fg-subtle">{t.size} · {t.weight}</p>
            </div>
            <p className={`text-${t.name} min-w-0 flex-1 text-fg`}>دارایی کل ۱۲٬۴۵۰٬۰۰۰ تومان</p>
            <p className="text-micro text-fg-subtle sm:w-40" dir="ltr">{t.use}</p>
          </div>
        ))}
      </div>
      <section className="space-y-2 rounded-card bg-panel p-4">
        <h2 className="text-title text-fg">اعداد</h2>
        <p className="text-callout text-fg-muted">Amounts use tabular figures (class `tabular`) so columns line up. Use the Amount component — it adds Persian digits, a real minus (−) and a smaller unit.</p>
        <div className="grid grid-cols-2 gap-2 text-body tabular">
          <span>۱٬۲۵۰٬۰۰۰</span><span>۹۸۰٬۰۰۰</span><span>۱۱۱٬۱۱۱</span><span>۸۸۸٬۸۸۸</span>
        </div>
      </section>
    </Page>
  ),
};

export const SpacingLayout: Story = {
  name: 'Spacing & Layout',
  render: () => (
    <Page title="فاصله‌گذاری و چیدمان" intro="4px base grid (Tailwind spacing). Page gutter 16px. Max content width 448px (phone first).">
      <div className="space-y-2 rounded-card bg-panel p-4">
        {spacing.map((s) => (
          <div key={s.token} className="flex items-center gap-4" dir="ltr">
            <span className="w-16 font-mono text-caption text-fg">{s.token} · {s.px}px</span>
            <span className="h-4 rounded-sm bg-accent" style={{ width: s.px * 2 }} />
            <span className="text-micro text-fg-subtle">{s.use}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2" dir="ltr">
        {[
          ['--ds-gutter', '16px', 'Page side padding'],
          ['--ds-topbar-height', '56px', 'TopBar row'],
          ['--ds-tabbar-height', '72px', 'TabBar (plus safe area)'],
          ['--ds-max-width', '448px', 'App column on wide screens'],
          ['touch-target', '44×44px', 'Minimum tap area utility'],
          ['z: sticky 20 · nav 40 · overlay 80 · popover 90 · toast 100', '', 'Stacking order'],
        ].map(([n, v, u]) => (
          <div key={n} className="rounded-card bg-panel p-3">
            <p className="font-mono text-caption text-fg">{n}</p>
            <p className="text-micro text-fg-subtle">{v} {u}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-card bg-panel p-4">
        <h2 className="text-title text-fg">Page rhythm</h2>
        <div className="space-y-6 rounded-control bg-sunken p-4">
          {['بخش اول', 'بخش دوم'].map((s) => (
            <div key={s} className="space-y-3">
              <div className="h-4 w-24 rounded-full bg-line-strong" />
              <div className="h-20 rounded-card bg-panel" />
            </div>
          ))}
        </div>
        <p className="text-caption text-fg-subtle">Sections: 24px apart. Inside a section: 12px. Card padding: 16px.</p>
      </div>
    </Page>
  ),
};

export const RadiusElevation: Story = {
  name: 'Radius & Elevation',
  render: () => (
    <Page title="گردی گوشه‌ها و سایه" intro="Three radius steps + full. The UI is flat: shadows only on floating layers.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {radii.map((r) => (
          <div key={r.name} className="space-y-2" dir="ltr">
            <div className={`h-20 bg-panel border border-line rounded-${r.name}`} />
            <p className="font-mono text-caption text-fg">rounded-{r.name}</p>
            <p className="text-micro text-fg-subtle">{r.value} · {r.use}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {shadows.map((s) => (
          <div key={s.name} className="space-y-2" dir="ltr">
            <div className={`h-20 rounded-card bg-elevated shadow-${s.name}`} />
            <p className="font-mono text-caption text-fg">shadow-{s.name}</p>
            <p className="text-micro text-fg-subtle">{s.use}</p>
          </div>
        ))}
      </div>
    </Page>
  ),
};

function MotionDemo() {
  const [on, setOn] = useState(false);
  return (
    <div className="space-y-3 rounded-card bg-panel p-4">
      <button type="button" onClick={() => setOn((v) => !v)} className="rounded-control bg-accent px-4 py-2 text-callout text-fg-on-accent">اجرا</button>
      {(['ease-standard', 'ease-emphasized', 'ease-exit'] as const).map((e) => (
        <div key={e} className="relative h-8 rounded-full bg-sunken" dir="ltr">
          <span className={`absolute top-1 left-1 size-6 rounded-full bg-accent transition-transform duration-500 ${e}`} style={{ transform: on ? 'translateX(calc(min(60vw, 560px)))' : 'none' }} />
          <span className="absolute inset-y-0 right-3 flex items-center font-mono text-micro text-fg-subtle">{e}</span>
        </div>
      ))}
    </div>
  );
}

export const Motion: Story = {
  render: () => (
    <Page title="حرکت" intro="Short and functional. Every animation respects prefers-reduced-motion (global rule in globals.css).">
      <div className="divide-y divide-line overflow-hidden rounded-card bg-panel" dir="ltr">
        {motion.map((m) => (
          <div key={m.name} className="flex items-center justify-between gap-4 p-3">
            <span className="font-mono text-caption text-fg">{m.name}</span>
            <span className="text-micro text-fg-subtle">{m.value} · {m.use}</span>
          </div>
        ))}
      </div>
      <MotionDemo />
    </Page>
  ),
};

const ICONS = { Home, Wallet, Coins, CalendarDays, Receipt, Plus, Search, Settings, Bell, ChevronLeft, MoreHorizontal, ArrowUpLeft, ArrowDownLeft, ArrowLeftRight, TrendingUp, PieChart, BarChart3, Target, Repeat, Landmark, CreditCard, Banknote, CircleDollarSign, FileText, Users };

export const Iconography: Story = {
  render: () => (
    <Page title="آیکون‌ها" intro="lucide-react, stroke 2. Sizes: 16 (inline), 20 (buttons, lists), 24 (tab bar). Icons inherit text color. Directional icons are mirrored for RTL: back = ArrowRight, forward/chevron = ChevronLeft.">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Object.entries(ICONS).map(([name, Icon]) => (
          <div key={name} className="flex flex-col items-center gap-2 rounded-card bg-panel p-3 text-fg-muted">
            <Icon className="size-5" />
            <span className="w-full truncate text-center font-mono text-micro text-fg-subtle" dir="ltr">{name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-6 rounded-card bg-panel p-4 text-fg">
        {[16, 20, 24].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2"><Wallet style={{ width: s, height: s }} /><span className="text-micro text-fg-subtle">{s}px</span></div>
        ))}
      </div>
    </Page>
  ),
};
