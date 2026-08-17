import { getPeriodRange } from './period.util';

describe('getPeriodRange', () => {
  it('daily spans exactly 24 hours starting at local midnight', () => {
    const { start, end } = getPeriodRange('daily', '2026-07-17');
    expect(start.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('weekly starts on Monday and spans 7 days', () => {
    // 2026-07-17 is a Friday
    const { start, end } = getPeriodRange('weekly', '2026-07-17');
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('weekly anchors correctly when the reference date is already Monday', () => {
    // 2026-07-13 is a Monday
    const { start } = getPeriodRange('weekly', '2026-07-13');
    expect(start.getDate()).toBe(13);
    expect(start.getDay()).toBe(1);
  });

  it('monthly spans the full calendar month', () => {
    const { start, end } = getPeriodRange('monthly', '2026-07-17');
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(6); // July, 0-indexed
    expect(end.getMonth()).toBe(7); // August
    expect(end.getDate()).toBe(1);
  });

  it('yearly spans Jan 1 through Jan 1 of the next year', () => {
    const { start, end } = getPeriodRange('yearly', '2026-07-17');
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(2026);
    expect(end.getFullYear()).toBe(2027);
  });

  it('defaults to today when no date is given', () => {
    const { start, end } = getPeriodRange('daily');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
