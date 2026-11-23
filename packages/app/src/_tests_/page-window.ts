import { fixtureDesktopOrigin } from "./desktop-fixture";

/** The parts of a browser location the modules under test read. */
export interface TestLocation {
  protocol: string;
  origin: string;
  assign?: (address: string) => void;
}

/** A browser tab's location, distinct from every local default unless supplied. */
export function tabAt(
  address = "https://app.example.test/sign-in",
): TestLocation {
  const url = new URL(address);
  return { protocol: url.protocol, origin: url.origin };
}

/**
 * The location of a page the desktop shell serves. The shell registers its
 * scheme as a standard one, so the page's origin is the fixture's literal;
 * Node's own URL parser would call a custom scheme's origin opaque.
 */
export function shellPage(): TestLocation {
  return {
    protocol: new URL(fixtureDesktopOrigin).protocol,
    origin: fixtureDesktopOrigin,
  };
}

/**
 * The parts of a page's `window` the modules under test use: its location,
 * the popup it opens, its tab-scoped and device storage and its focus
 * listeners.
 */
export interface TestPage {
  location?: TestLocation;
  open?: (address: string, target?: string, features?: string) => unknown;
  sessionStorage?: Storage;
  localStorage?: Storage;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/**
 * Run with `globalThis.window` standing in for one page, then restore what was
 * there, so no test leaks its page into the next. `undefined` is server
 * rendering, with no window at all; a window with no location is iOS and
 * Android.
 */
export function withWindow(page: TestPage | undefined, run: () => void): void {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "window");
  if (page === undefined) Reflect.deleteProperty(globalThis, "window");
  else
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: page,
    });
  try {
    run();
  } finally {
    if (saved) Object.defineProperty(globalThis, "window", saved);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

/**
 * A tab's `sessionStorage` held in memory. `refuse` makes every operation
 * throw, as a browser does when storage is disabled or full.
 */
export function memoryStorage(refuse = false): Storage {
  const items = new Map<string, string>();
  const check = () => {
    if (refuse) throw new Error("storage refused");
  };
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      check();
      items.clear();
    },
    getItem: (key: string) => {
      check();
      return items.get(key) ?? null;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    removeItem: (key: string) => {
      check();
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      check();
      items.set(key, value);
    },
  };
}

/**
 * `withWindow` for work that continues after a promise, such as a press whose
 * handler awaits a digest: the stand-in stays in place until `run` settles.
 */
export async function withWindowAsync(
  page: TestPage | undefined,
  run: () => Promise<void>,
): Promise<void> {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "window");
  if (page === undefined) Reflect.deleteProperty(globalThis, "window");
  else
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: page,
    });
  try {
    await run();
  } finally {
    if (saved) Object.defineProperty(globalThis, "window", saved);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

/**
 * Run with every random byte the page asks Web Crypto for set to `byte`, so a
 * verifier, and the challenge derived from it, are known in advance. Digests
 * stay real.
 */
export async function withRandomBytes(
  byte: number,
  run: () => Promise<void>,
): Promise<void> {
  const real = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      subtle: real.subtle,
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) array.fill(byte);
        return array;
      },
    },
  });
  try {
    await run();
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: real,
    });
  }
}
