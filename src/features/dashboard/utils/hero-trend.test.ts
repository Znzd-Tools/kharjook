import { describe, expect, it } from 'vitest';
import { heroTrend, trendChangePct } from './hero-trend';

const row = (d: string, t: number) => ({ date_string: d, total_toman: t, total_usd: t / 100 });

describe('hero trend', () => {
  const rows = [row('1405/07/01', 100), row('1405/08/01', 110), row('1405/08/20', 120), row('1405/09/03', 999)];
  const live = { date: '1405/09/03', toman: 130, usd: 1.3 };

  it('range from a date; live value replaces today', () => {
    const p = heroTrend(rows, '1m', 'TOMAN', live, '1405/08/03');
    expect(p.map((x) => x.value)).toEqual([120, 130]);
    expect(p.at(-1)!.label).toBe('امروز');
  });
  it('USD unit', () => {
    expect(heroTrend(rows, '1y', 'USD', live, '1404/09/03').map((x) => x.value)).toEqual([1, 1.1, 1.2, 1.3]);
  });
  it('thins long ranges to at most 60 points and keeps the newest', () => {
    const many = Array.from({ length: 300 }, (_, i) => row(`1405/${String(1 + Math.floor(i / 30)).padStart(2, '0')}/${String(1 + (i % 30)).padStart(2, '0')}`, i));
    const p = heroTrend(many, '1y', 'TOMAN', { date: '1406/01/01', toman: 1, usd: 1 }, '1300/01/01');
    expect(p.length).toBeLessThanOrEqual(60);
    expect(p.at(-2)!.value).toBe(299);
  });
  it('change in percent', () => {
    expect(trendChangePct([{ key: 'a', label: '', value: 100 }, { key: 'b', label: '', value: 125 }])).toBe(25);
    expect(trendChangePct([{ key: 'a', label: '', value: 0 }, { key: 'b', label: '', value: 5 }])).toBeNull();
  });
});
