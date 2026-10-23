/** Origin-local preferences the standalone bundle reads before its first render. */

import {
  disclosureStorageKey,
  parseDisclosureMap,
} from "../shell/disclosure_storage.js";
import type { ShellInitialState } from "../shell/store_state.js";

const DETAILS_KEY = "mokly:details-disclosure";
const WIDTH_KEY = "mokly:navigation-width:v1";
const MINIMUM_WIDTH = 192;
const MAXIMUM_WIDTH = 480;

/** The storage and viewport surface this module reads. */
export interface PreferenceWindow {
  innerWidth: number;
  localStorage?: Pick<Storage, "getItem"> | undefined;
}

/**
 * Read the stored disclosure map, Details choice and navigation width. A
 * blocked or invalid store is a missing preference, never a failure.
 */
export function readStandalonePreferences(
  win: PreferenceWindow,
  colorScheme: "dark" | "light",
): ShellInitialState {
  const read = (key: string): string | null => {
    try {
      return win.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const disclosures = parseDisclosureMap(read(disclosureStorageKey));
  const details = read(DETAILS_KEY);
  const maximum = Math.max(
    MINIMUM_WIDTH,
    Math.min(MAXIMUM_WIDTH, Math.floor(win.innerWidth / 2)),
  );
  const stored = Number(read(WIDTH_KEY) ?? Number.NaN);
  return {
    colorScheme,
    disclosures,
    ...(details === "open" || details === "closed"
      ? { detailsOpen: details === "open" }
      : {}),
    navigationMaximum: maximum,
    ...(Number.isFinite(stored)
      ? {
          navigationWidth: Math.round(
            Math.max(MINIMUM_WIDTH, Math.min(maximum, stored)),
          ),
        }
      : {}),
  };
}
