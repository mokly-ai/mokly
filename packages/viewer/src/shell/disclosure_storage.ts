/** Versioned disclosure persistence shared by early capture, hydration and recovery. */

import { isDisclosureKey } from "./disclosure_keys.js";

/** The only current localStorage key for navigation disclosures. */
export const disclosureStorageKey = "mokly:nav-disclosure:v3";

/** Obsolete closed-list key, removed on the first current write. */
export const obsoleteDisclosureStorageKey = "mokly:nav-disclosure:v2";

/** Whether a decoded value has the required object shape (not an array). */
export function isDisclosureMap(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Ignore malformed entries individually, and malformed containers in full. */
export function decodeDisclosureMap(value: unknown): Record<string, boolean> {
  if (!isDisclosureMap(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] =>
        isDisclosureKey(entry[0]) && typeof entry[1] === "boolean",
    ),
  );
}

/** Parse a stored JSON object without adopting older storage shapes. */
export function parseDisclosureMap(
  raw: string | null,
): Record<string, boolean> {
  if (raw === null) return {};
  try {
    return decodeDisclosureMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Encode only valid current keys and boolean values. */
export function encodeDisclosureMap(
  disclosures: Readonly<Record<string, boolean>>,
): string {
  return JSON.stringify(decodeDisclosureMap(disclosures));
}

/** Apply valid stored values only to keys that exist in the current navigation. */
export function restoreDisclosureMap(
  defaults: Readonly<Record<string, boolean>>,
  stored: unknown,
): Record<string, boolean> {
  const values = { ...defaults };
  for (const [key, value] of Object.entries(decodeDisclosureMap(stored))) {
    if (Object.hasOwn(values, key)) values[key] = value;
  }
  return values;
}
