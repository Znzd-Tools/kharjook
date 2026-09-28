import { describe, expect, it } from 'vitest';
import { buildInstallmentSchedule, nthIntervalDate } from '@/features/deadlines/utils/schedule';

describe('buildInstallmentSchedule', () => {
  it('does not drift a month-end day after a short month', () => {
    const dates = buildInstallmentSchedule({
      firstDueDate: '1403/06/31',
      repeatCount: 8,
      intervalNumber: 1,
      intervalPeriod: 'month',
    });
    expect(dates).toEqual([
      '1403/06/31',
      '1403/07/30',
      '1403/08/30',
      '1403/09/30',
      '1403/10/30',
      '1403/11/30',
      '1403/12/30', // 1403 is a leap year
      '1404/01/31', // back to 31 — the old code stayed on 30
    ]);
  });

  it('keeps weekly schedules exact', () => {
    expect(
      buildInstallmentSchedule({
        firstDueDate: '1403/01/01',
        repeatCount: 3,
        intervalNumber: 1,
        intervalPeriod: 'week',
      })
    ).toEqual(['1403/01/01', '1403/01/08', '1403/01/15']);
  });

  it('nthIntervalDate index 0 is the anchor', () => {
    const anchor = { jy: 1403, jm: 6, jd: 31 };
    expect(nthIntervalDate(anchor, 1, 'month', 0)).toEqual(anchor);
  });
});
