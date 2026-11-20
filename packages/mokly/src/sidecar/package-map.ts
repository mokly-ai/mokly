import path from "node:path";

import { mappedFiles, resolutionExtensions } from "./mapped-selection.js";
import { PackageJson, packageFolderKey } from "./package-json.js";
import { substituteTarget, substitution } from "./path-pattern.js";
import type { PhysicalInputs } from "./physical-inputs.js";

export interface PackageTarget {
  target: string;
  folder: boolean;
  selected: boolean;
}

interface Match {
  key: string;
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
  requireComplete = false,
): Generator<PackageTarget> {
  if (depth > 32) {
    if (tolerateUnsupported && !matched?.folder && !requireComplete) return;
    throw new Error("package export evidence limit");
  }
  if (typeof value === "string") {
    if (value.includes("*") && matched === undefined && !tolerateUnsupported)
      throw new Error("unmapped export pattern");
    const target = matched?.folder
      ? value + matched.tail
      : substituteTarget(matched?.key ?? requested, value, requested, "all");
    if (target === undefined) return;
    yield {
      target,
      folder: matched?.folder ?? false,
      selected: matched?.selected ?? true,
    };
  } else if (Array.isArray(value)) {
    const strings = new Set<string>();
    for (const item of value) {
      if (typeof item === "string") {
        if (strings.has(item)) continue;
        strings.add(item);
      }
      yield* packageMapTargets(
        item,
        requested,
        matched,
        depth + 1,
        tolerateUnsupported,
        requireComplete,
      );
    }
  } else if (value instanceof PackageJson) {
    const chosen = selectedKey(value.entries, requested);
    for (const [key, target] of value.entries) {
      if (key.startsWith(".") || key.startsWith("#")) {
        if (!tolerateUnsupported && key.split("*").length > 2)
          throw new Error("unsupported export pattern");
        const folder = packageFolderKey(key);
        if (folder && key !== chosen) continue;
        const tail =
          folder && requested.startsWith(key)
            ? requested.slice(key.length)
            : substitution(key, requested);
        if (tail === undefined) continue;
        yield* packageMapTargets(
          target,
          requested,
          { key, tail, folder, selected: key === chosen },
          depth + 1,
          tolerateUnsupported,
          requireComplete,
        );
      } else
        yield* packageMapTargets(
          target,
          requested,
          matched,
          depth + 1,
          tolerateUnsupported,
          requireComplete,
        );
    }
  } else if (value !== undefined && value !== null && !tolerateUnsupported)
    throw new Error("unsupported package exports");
}

function selectedKey(
  entries: Array<[string, unknown]>,
  requested: string,
): string | undefined {
  let chosen: string | undefined;
  for (let index = 0; index < entries.length; index++) {
    const key = entries[index]![0];
    const star = key.indexOf("*");
    if (key === requested && !key.endsWith("/") && star < 0) return key;
    if (star < 0 && !key.endsWith("/")) continue;
    const matches =
      star >= 0
        ? substitution(key, requested) !== undefined &&
          (star === key.length - 1 || requested.length >= key.length)
        : requested.startsWith(key);
    if (matches && (chosen === undefined || patternOrder(key, chosen) < 0))
      chosen = key;
  }
  return chosen;
}

function patternOrder(a: string, b: string): number {
  const aStar = a.indexOf("*");
  const bStar = b.indexOf("*");
  return (
    (bStar < 0 ? b.length : bStar) - (aStar < 0 ? a.length : aStar) ||
    Number(aStar < 0) - Number(bStar < 0) ||
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
  const seen = new Set<string>();
  for (const field of new Set(["main", "module", ...mainFields]))
    for (const target of manifest.values(field))
      if (typeof target === "string" && target && !seen.has(target)) {
        seen.add(target);
        yield path.resolve(pkg, target);
      }
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
