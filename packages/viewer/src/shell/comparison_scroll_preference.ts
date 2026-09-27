/**
 * The reader's Scroll together choice. Standalone Serve and export keep it in
 * origin storage; an embedded viewer keeps it in memory for its mount and
 * never touches storage. A missing, invalid or unreadable value means on, and
 * a refused write keeps the choice for the open document.
 */

/** Origin-local key holding `on` or `off`. */
export const SCROLL_TOGETHER_STORAGE_KEY = "mokly:comparison-scroll-together";

/** One mount's Scroll together choice, observable by React. */
export interface ScrollTogetherPreference {
  /** Whether Scroll together is on. */
  read(): boolean;
  /** Hear every change until the returned function is called. */
  subscribe(listener: () => void): () => void;
  /** Record the reader's choice. */
  write(on: boolean): void;
}

/** The slice of `Storage` the standalone preference uses. */
export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Only an exact `off` turns Scroll together off. */
export function parseScrollTogether(value: string | null | undefined): boolean {
  return value !== "off";
}

function preference(
  initial: () => boolean,
  persist: (on: boolean) => void,
): ScrollTogetherPreference {
  const listeners = new Set<() => void>();
  let value: boolean | undefined;
  return {
    read: () => (value ??= initial()),
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    write(on) {
      if (on === value) return;
      value = on;
      persist(on);
      for (const listener of [...listeners]) listener();
    },
  };
}

/**
 * The standalone preference over origin storage. `storage` is called on each
 * access because reaching for `localStorage` itself throws on a blocked origin.
 */
export function storedScrollTogether(
  storage: () => PreferenceStorage | undefined,
): ScrollTogetherPreference {
  return preference(
    () => {
      try {
        return parseScrollTogether(
          storage()?.getItem(SCROLL_TOGETHER_STORAGE_KEY),
        );
      } catch {
        return true;
      }
    },
    (on) => {
      try {
        storage()?.setItem(SCROLL_TOGETHER_STORAGE_KEY, on ? "on" : "off");
      } catch {
        return;
      }
    },
  );
}

/** An embedded viewer's preference, kept in memory for its mount. */
export function memoryScrollTogether(): ScrollTogetherPreference {
  return preference(
    () => true,
    () => undefined,
  );
}

/** Scroll together for a shell without a comparison host: always on. */
export const FIXED_SCROLL_TOGETHER: ScrollTogetherPreference = {
  read: () => true,
  subscribe: () => () => undefined,
  write: () => undefined,
};
