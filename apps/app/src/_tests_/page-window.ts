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
 * Run with `globalThis.window` standing in for one page, then restore what was
 * there, so no test leaks its page into the next. `undefined` is server
 * rendering, with no window at all; a window with no location is iOS and
 * Android.
 */
export function withWindow(
  page: { location?: TestLocation } | undefined,
  run: () => void,
): void {
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
