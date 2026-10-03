import {
  entryRoute,
  isSafeRepositoryPath,
  viewRoute,
} from "@mokly/viewer/data";
import type { ManifestEntry, ManifestV8 } from "@mokly/viewer/data";

import { incompatibleEarlierBaseline } from "../baseline/compatibility.js";
import { MoklyError } from "../errors.js";

import { record } from "./manifest_values.js";

/** Admit historical metadata only when its stored paths preserve the fixed pane origin. */
export function assertHistoricalLayout(
  value: unknown,
  normalized: ManifestV8,
): void {
  if (
    !record(value) ||
    ![3, 4, 5, 6].includes(value.schemaVersion as number) ||
    !Array.isArray(value.entries)
  )
    return;
  const entries = new Map(normalized.entries.map((entry) => [entry.id, entry]));
  let compatible = true;
  const checkPath = (value: unknown, expected: string): void => {
    if (
      typeof value !== "string" ||
      !isSafeRepositoryPath(value) ||
      !value.endsWith(".html") ||
      /[?#%]/u.test(value)
    )
      throw new MoklyError(
        "manifest-invalid",
        "historical output paths must be safe relative HTML paths",
      );
    if (value !== expected) compatible = false;
  };
  const checkEntry = (
    raw: Record<string, unknown>,
    entry: ManifestEntry,
  ): void => {
    if (raw.route !== undefined)
      checkPath(raw.route, entryRoute(entry.kind, entry.id));
    for (const [field, scheme] of [
      ["fragments", "light"],
      ["darkFragments", "dark"],
    ] as const) {
      if (raw[field] === undefined) continue;
      const fragments = raw[field];
      if (
        !record(fragments) ||
        Object.keys(fragments).length !== 2 ||
        !Object.hasOwn(fragments, "mobile") ||
        !Object.hasOwn(fragments, "desktop") ||
        (entry.kind !== "screen" && entry.kind !== "component")
      )
        throw new MoklyError(
          "manifest-invalid",
          "historical fragments must name mobile and desktop HTML paths",
        );
      for (const viewport of ["mobile", "desktop"] as const)
        checkPath(
          fragments[viewport],
          viewRoute(entry.kind, entry.id, viewport, scheme),
        );
    }
  };
  for (const raw of value.entries) {
    if (!record(raw) || raw.kind === "collection") continue;
    const entry = entries.get(String(raw.id));
    if (!entry) continue;
    checkEntry(raw, entry);
    if (entry.kind !== "component" || !Array.isArray(raw.variants)) continue;
    for (const rawVariant of raw.variants) {
      if (!record(rawVariant)) continue;
      const id = String(rawVariant.id);
      const variant = entries.get(
        id.startsWith(`${entry.id}-`) ? id : `${entry.id}-${id}`,
      );
      if (variant) checkEntry(rawVariant, variant);
    }
  }
  if (!compatible) throw incompatibleEarlierBaseline();
}
