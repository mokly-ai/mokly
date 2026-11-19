import path from "node:path";

import { mappedFiles, resolutionExtensions } from "./mapped-selection.js";
import { PackageJson } from "./package-json.js";
import { substitution } from "./path-pattern.js";
import type { PhysicalInputs } from "./physical-inputs.js";

export interface PackageTarget {
  target: string;
  folder: boolean;
  selected: boolean;
}

interface Match {
  tail: string;
  folder: boolean;
  selected: boolean;
}

/** Describe every target of matching keys, conditions, and arrays through one walker. */
export function* packageMapTargets(
  value: unknown,
  requested: string,
  matched?: Match,
  depth = 0,
  tolerateUnsupported = false,
): Generator<PackageTarget> {
  if (depth > 32) {
    if (tolerateUnsupported && !matched?.folder) return;
    throw new Error("package export evidence limit");
  }
  if (typeof value === "string") {
    if (value.includes("*") && matched === undefined && !tolerateUnsupported)
      throw new Error("unmapped export pattern");
    const target = matched?.folder
      ? value + matched.tail
      : value.replaceAll("*", matched?.tail ?? "");
    yield {
      target,
      folder: matched?.folder ?? false,
      selected: matched?.selected ?? true,
    };
  } else if (Array.isArray(value)) {
    for (const item of value)
      yield* packageMapTargets(
        item,
        requested,
        matched,
        depth + 1,
        tolerateUnsupported,
      );
  } else if (value instanceof PackageJson) {
    const chosen = selectedKey(value.entries, requested);
    for (const [key, target] of value.entries) {
      if (key.startsWith(".") || key.startsWith("#")) {
        if (key.split("*").length > 2 && !tolerateUnsupported)
          throw new Error("unsupported export pattern");
        const folder = key.endsWith("/") && !key.includes("*");
        if (folder && key !== chosen) continue;
        const tail =
          folder && requested.startsWith(key)
            ? requested.slice(key.length)
            : substitution(key, requested);
        if (tail === undefined) continue;
        yield* packageMapTargets(
          target,
          requested,
          { tail, folder, selected: key === chosen },
          depth + 1,
          tolerateUnsupported,
        );
      } else
        yield* packageMapTargets(
          target,
          requested,
          matched,
          depth + 1,
          tolerateUnsupported,
        );
    }
  } else if (value !== undefined && value !== null && !tolerateUnsupported)
    throw new Error("unsupported package exports");
}

function selectedKey(
  entries: Array<[string, unknown]>,
  requested: string,
): string | undefined {
  const exact = entries.find(
    ([key]) => key === requested && !key.endsWith("/") && !key.includes("*"),
  );
  if (exact) return exact[0];
  return entries
    .filter(([key]) => key.endsWith("/") || key.includes("*"))
    .sort(([a], [b]) => patternOrder(a, b))
    .find(([key]) =>
      key.includes("*")
        ? substitution(key, requested) !== undefined &&
          (!key.slice(key.indexOf("*") + 1) || requested.length >= key.length)
        : requested.startsWith(key),
    )?.[0];
}

function patternOrder(a: string, b: string): number {
  const base = (key: string) =>
    key.includes("*") ? key.indexOf("*") : key.length;
  return (
    base(b) - base(a) ||
    Number(!a.includes("*")) - Number(!b.includes("*")) ||
    b.length - a.length
  );
}

/** Decode only the package-relative map result, as esbuild does before probing. */
export function packageTarget(pkg: string, target: string): string {
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    // Invalid inactive targets keep their previous conservative observation.
  }
  return path.resolve(pkg, decoded);
}

export function* packageMainTargets(
  pkg: string,
  manifest: PackageJson,
  mainFields: string[],
): Generator<string> {
  for (const field of new Set(["main", "module", ...mainFields]))
    for (const target of manifest.values(field))
      if (typeof target === "string" && target) yield path.resolve(pkg, target);
}

/** Inexact map targets also probe a folder's main fields before its index files. */
export function* packageFolderCandidates(
  base: string,
  inputs: PhysicalInputs,
  mainFields: string[],
  observe = true,
  current = false,
  allowNonObject = false,
): Generator<string> {
  yield base;
  const manifest = inputs.packageJson(
    path.join(base, "package.json"),
    observe,
    current,
    allowNonObject,
  );
  if (manifest) yield* packageMainTargets(base, manifest, mainFields);
}

export function* packageFolderFiles(
  base: string,
  extensions: readonly string[],
): Generator<string> {
  yield* mappedFiles(base, extensions);
  for (const extension of resolutionExtensions(extensions))
    yield path.join(base, "index" + extension);
}
