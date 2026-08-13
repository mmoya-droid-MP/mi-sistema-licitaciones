import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce rapid value changes (e.g. text input keystrokes, pastes, backspaces).
 * Delays updating the debounced value by delayMs (default 300ms) to keep UI inputs smooth and lag-free.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
