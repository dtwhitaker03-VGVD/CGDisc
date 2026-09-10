import { useCallback, useEffect, useState } from "react";

const PREFIX = "cgdisc:v1:";

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable; fail silently, data stays in memory for this session
  }
}

/** Persist state to localStorage, syncing between updates within the same tab. */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  const update = useCallback((updater: T | ((prev: T) => T)) => {
    setValue((prev) =>
      typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater,
    );
  }, []);

  return [value, update] as const;
}
