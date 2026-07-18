import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from './use-debounce';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  it('does not update before the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe('a');
  });

  it('updates to the latest value once the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid successive changes (only the last value wins)', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => jest.advanceTimersByTime(200));
    rerender({ value: 'c' });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe('a'); // still not settled

    act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe('c');
  });
});
