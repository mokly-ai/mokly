import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";

/**
 * The browser storage key that keeps the Theme the reader chose in the
 * account menu, on this device only. It is the only place the choice is kept:
 * no cookie, no request and no account field carries it.
 */
export const themeChoiceKey = "mokly.theme";

/** The scheme a stored value names, when it names one. */
export function parseThemeChoice(value: unknown): TokenColorScheme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

/** This page's local storage, or nothing where the browser refuses it. */
function deviceStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The Theme the reader chose on this device, or nothing before they choose.
 * A value that names no scheme is no choice, and storage that refuses the read
 * keeps none.
 */
export function readThemeChoice(): TokenColorScheme | undefined {
  try {
    return parseThemeChoice(deviceStorage()?.getItem(themeChoiceKey));
  } catch {
    return undefined;
  }
}

/**
 * Keep the reader's choice on this device, in place of any earlier one.
 * Storage that refuses the write leaves the choice to this page alone, and
 * the reader is not told, because the scheme they chose still applies.
 */
export function writeThemeChoice(scheme: TokenColorScheme): void {
  try {
    deviceStorage()?.setItem(themeChoiceKey, scheme);
  } catch {
    return;
  }
}
