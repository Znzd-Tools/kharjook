import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Coffee, Landmark, Percent, Wallet } from 'lucide-react';
import { useState } from 'react';
import { AmountField } from './AmountField';
import { Avatar } from './Avatar';
import { Checkbox } from './Checkbox';
import { DateField } from './DateField';
import { Disclosure } from './Disclosure';
import { Field } from './Field';
import { Keypad } from './Keypad';
import { PickerField } from './PickerSheet';
import { RadioGroup } from './RadioGroup';
import { SegmentedControl } from './SegmentedControl';
import { Switch } from './Switch';
import { Input, SearchField, Textarea } from './TextField';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';

const meta = { title: 'Forms', tags: ['autodocs'] } satisfies Meta;
export default meta;
type Story = StoryObj;

export const TextInputs: Story = {
  name: 'Field & Input',
  parameters: { docs: { description: { story: 'Wrap every control in `Field` for label, hint and error. Labels sit above the control.' } } },
  render: () => (
    <div className="space-y-4">
      <Field label="نام کیف پول" hint="مثلاً «ملت جاری»">
        <Input placeholder="نام" />
      </Field>
      <Field label="کارمزد" labelEnd="اختیاری">
        <Input inputMode="decimal" startAdornment={<Percent />} endAdornment="تومان" placeholder="0" />
      </Field>
      <Field label="شماره کارت" error="۱۶ رقم وارد کن." required>
        <Input dir="ltr" defaultValue="6104 33" />
      </Field>
      <Field label="غیرفعال" disabled>
        <Input value="قابل تغییر نیست" readOnly />
      </Field>
      <Field label="یادداشت">
        <Textarea placeholder="توضیح کوتاه…" />
      </Field>
    </div>
  ),
};

export const SearchStory: Story = {
  name: 'SearchField',
  render: function Render() {
    const [q, setQ] = useState('کافه');
    return <SearchField value={q} onValueChange={setQ} placeholder="جستجو در تراکنش‌ها" />;
  },
};

export const AmountStory: Story = {
  name: 'AmountField',
  parameters: { docs: { description: { story: 'Shows the amount in words under the number ("۱۲٫۵ میلیون تومان") to stop zero-count mistakes. `hero` size is for the amount-first add screen.' } } },
  render: function Render() {
    const [a, setA] = useState('12500000');
    const [b, setB] = useState('');
    return (
      <div className="space-y-6">
        <Field label="مبلغ"><AmountField value={a} onValueChange={setA} /></Field>
        <Field label="مبلغ دلاری"><AmountField value={b} onValueChange={setB} currency="USD" /></Field>
        <div className="rounded-card bg-panel"><AmountField size="hero" value={a} onValueChange={setA} /></div>
      </div>
    );
  },
};

export const KeypadStory: Story = {
  name: 'Keypad',
  parameters: { docs: { description: { story: 'In-app keypad for the amount-first flow. "۰۰۰" adds three zeros (toman). Long-press ⌫ clears.' } } },
  render: function Render() {
    const [v, setV] = useState('');
    return (
      <div className="space-y-2 rounded-card bg-panel p-3">
        <AmountField size="hero" value={v} onValueChange={setV} readOnly />
        <Keypad value={v} onValueChange={setV} />
      </div>
    );
  },
};

export const Choices: Story = {
  name: 'Switch · Checkbox · Radio',
  render: function Render() {
    const [r, setR] = useState('monthly');
    return (
      <div className="space-y-6">
        <div className="space-y-4 rounded-card bg-panel p-4">
          <Switch label="اعلان سررسیدها" description="ساعت ۹ صبح در تلگرام" defaultChecked />
          <Switch label="خلاصه هفتگی" />
          <Switch label="غیرفعال" disabled />
        </div>
        <div className="space-y-3 rounded-card bg-panel p-4">
          <Checkbox label="از ارزش کل سبد حذف شود" description="مثلاً پول امانی" />
          <Checkbox label="انتخاب‌شده" defaultChecked />
          <Checkbox label="نیمه‌انتخاب" indeterminate />
        </div>
        <RadioGroup
          aria-label="تکرار"
          variant="card"
          value={r}
          onValueChange={setR}
          options={[
            { value: 'weekly', label: 'هفتگی' },
            { value: 'monthly', label: 'ماهانه', description: 'روز اول هر ماه' },
            { value: 'yearly', label: 'سالانه' },
          ]}
        />
      </div>
    );
  },
};

export const Segmented: Story = {
  name: 'SegmentedControl',
  render: function Render() {
    const [a, setA] = useState<'assets' | 'wallets'>('assets');
    const [c, setC] = useState<'TOMAN' | 'USD'>('TOMAN');
    const [p, setP] = useState<'m' | 'q' | 'y'>('m');
    return (
      <div className="space-y-4">
        <SegmentedControl aria-label="نما" value={a} onValueChange={setA} options={[{ value: 'assets', label: 'دارایی‌ها' }, { value: 'wallets', label: 'کیف پول‌ها' }]} />
        <SegmentedControl aria-label="واحد" size="sm" fullWidth={false} value={c} onValueChange={setC} options={[{ value: 'TOMAN', label: 'تومان' }, { value: 'USD', label: 'دلار' }]} />
        <SegmentedControl aria-label="بازه" value={p} onValueChange={setP} options={[{ value: 'm', label: 'ماه' }, { value: 'q', label: 'فصل' }, { value: 'y', label: 'سال' }]} />
      </div>
    );
  },
};

const WALLETS = [
  { value: 'mellat', label: 'بانک ملت', description: '۴۸٬۲۰۰٬۰۰۰ تومان', leading: <Avatar size="sm" fallback={<Landmark />} tone="info" />, group: 'بانک' },
  { value: 'saman', label: 'بانک سامان', description: '۱۲٬۰۰۰٬۰۰۰ تومان', leading: <Avatar size="sm" fallback={<Landmark />} tone="info" />, group: 'بانک' },
  { value: 'cash', label: 'نقد', description: '۱٬۳۵۰٬۰۰۰ تومان', leading: <Avatar size="sm" fallback={<Wallet />} tone="positive" />, group: 'نقد' },
  { value: 'cafe', label: 'کارت هدیه کافه', description: '۲۰۰٬۰۰۰ تومان', leading: <Avatar size="sm" fallback={<Coffee />} tone="warning" />, group: 'سایر' },
];

export const Picker: Story = {
  name: 'PickerField & PickerSheet',
  parameters: { docs: { description: { story: 'For long lists (wallets, assets, categories, people). Supports groups, search and a "recent" group on top.' } } },
  render: function Render() {
    const [v, setV] = useState<string | null>('mellat');
    return (
      <Field label="از کیف پول">
        <PickerField title="انتخاب کیف پول" options={WALLETS} value={v} onValueChange={setV} recent={['cash']} searchable />
      </Field>
    );
  },
};

export const DateStory: Story = {
  name: 'DateField & Calendar',
  render: function Render() {
    const [d, setD] = useState(formatJalaali(todayJalaali()));
    return (
      <Field label="تاریخ">
        <DateField value={d} onValueChange={setD} />
      </Field>
    );
  },
};

export const Advanced: Story = {
  name: 'Disclosure',
  parameters: { docs: { description: { story: 'Hide rare fields (note, fee, repeat) to keep forms short.' } } },
  render: () => (
    <div className="rounded-card bg-panel p-4">
      <Disclosure title="جزئیات بیشتر" summary="بدون یادداشت · بدون کارمزد">
        <div className="space-y-4">
          <Field label="یادداشت"><Textarea placeholder="…" /></Field>
          <Field label="کارمزد"><Input inputMode="decimal" endAdornment="تومان" /></Field>
          <Switch label="تکرار ماهانه" />
        </div>
      </Disclosure>
    </div>
  ),
};
