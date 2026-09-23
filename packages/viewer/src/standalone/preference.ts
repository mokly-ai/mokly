/**
 * The standalone catalogue's Appearance preference. Normalization is pure and
 * stays separate from storage access, so a blocked or absent origin store is a
 * missing preference rather than a failure, and so the embedded React entry
 * never reaches for storage at all.
 */

import type { ViewerTheme } from "../viewer/types.js";

/** Origin-local key holding an explicit override; Auto is its absence. */
export const APPEARANCE_STORAGE_KEY = "mokly:theme";

/** The slice of `Storage` this module uses, so a test can supply its own. */
export interface AppearanceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** An appearance a reader can pin or store; Auto is never one of these. */
export type ExplicitAppearance = "dark" | "light";

function explicit(value: unknown): ExplicitAppearance | undefined {
  return value === "dark" || value === "light" ? value : undefined;
}

/**
 * The `scheme` query parameter, which pins one document without saving. Only an
 * exact `light` or `dark` counts, so a stale or hand-edited link falls through
 * to the reader's own preference rather than pinning something unintended.
 */
export function schemePin(search: string): ExplicitAppearance | undefined {
  return explicit(new URLSearchParams(search).get("scheme"));
}

/** The stored override, or nothing when it is absent, invalid or unreadable. */
export function readStoredAppearance(
  storage: AppearanceStorage,
): ExplicitAppearance | undefined {
  try {
    return explicit(storage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/**
 * Records an explicit choice and clears the override for Auto. A store that
 * refuses the write leaves the current document's choice in place, so the
 * reader keeps what they picked and navigation is unaffected.
 */
export function storeAppearance(
  storage: AppearanceStorage,
  theme: ViewerTheme,
): void {
  try {
    const value = explicit(theme);
    if (value) storage.setItem(APPEARANCE_STORAGE_KEY, value);
    else storage.removeItem(APPEARANCE_STORAGE_KEY);
  } catch {
    // A blocked origin store must not break navigation or raise an error.
  }
}

/** The inputs a full page load resolves the effective appearance from. */
export interface AppearanceInputs {
  /** A choice made in this document, which outranks everything else. */
  chosen?: ViewerTheme | undefined;
  pin?: ExplicitAppearance | undefined;
  stored?: ExplicitAppearance | undefined;
  initial?: ViewerTheme | undefined;
}

/**
 * The documented order: a choice made here, then the URL pin, then the stored
 * override, then the server-supplied initial theme, then Auto.
 */
export function resolveAppearance(inputs: AppearanceInputs): ViewerTheme {
  return (
    inputs.chosen ?? inputs.pin ?? inputs.stored ?? inputs.initial ?? "auto"
  );
}

/** The preview scheme an appearance selects, resolving Auto through the system. */
export function effectiveScheme(
  theme: ViewerTheme,
  systemDark: boolean,
): ExplicitAppearance {
  return theme === "auto" ? (systemDark ? "dark" : "light") : theme;
}
