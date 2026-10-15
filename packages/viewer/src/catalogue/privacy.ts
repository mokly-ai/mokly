import { denseArray, invalidData, plainKeys } from "../components/data.js";

import { repositoryPath } from "./values.js";

const PRIVATE_KEYS = new Set([
  "dependencies",
  "sourceFiles",
  "movedFrom",
  "declaredDependencies",
  "ownedDependencies",
  "startOffset",
  "endOffset",
  "styles",
  "resources",
  "manifest",
  "baseline",
  "changedPaths",
  "headDigests",
  "sourceGraph",
  "renderCapability",
  "resolvedDependencies",
  "dependencyEvidence",
  "baselineManifest",
  "sourceMaps",
  "gitCommands",
  "styleOwnership",
  "resourceOwnership",
  "credentials",
  "token",
  "authorization",
  "cookies",
]);

/** Index fields that only an entry detail carries, rejected at any depth. */
const DETAIL_KEYS = new Set(["usage", "resourceEvidence"]);

/** The index carries no private evidence and no per-view usage or evidence. */
export function assertPublicIndex(value: unknown): void {
  assertPublicData(
    value,
    "$catalogue",
    (key) => PRIVATE_KEYS.has(key) || DETAIL_KEYS.has(key),
  );
}

/** A detail carries public evidence records but no private evidence. */
export function assertPublicDetail(value: unknown): void {
  assertPublicData(
    value,
    "$detail",
    (key, parent) =>
      PRIVATE_KEYS.has(key) &&
      !(key === "resources" && parent === "resourceEvidence"),
  );
}

/** Unknown extensions stay additive but cannot smuggle private evidence or paths. */
function assertPublicData(
  value: unknown,
  at: string,
  forbidden: (key: string, parent: string | undefined) => boolean,
): void {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (
    item: unknown,
    depth: number,
    data = false,
    parent?: string,
  ): void => {
    if (++nodes > 5_000_000 || depth > 128)
      invalidData(at, "public data limit exceeded");
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item))
    )
      return;
    if (typeof item !== "object" || item === null || ancestors.has(item))
      invalidData(at, "expected acyclic JSON data");
    ancestors.add(item);
    if (Array.isArray(item)) {
      denseArray(item, at);
      for (const child of item) visit(child, depth + 1, data, parent);
    } else
      for (const key of plainKeys(item, at)) {
        const child = (item as Record<string, unknown>)[key];
        if (!data && forbidden(key, parent))
          invalidData(at, `${key} is not public catalogue data`);
        if (!data && /(?:Path$|^path$)/.test(key) && typeof child === "string")
          repositoryPath(child);
        if (
          !data &&
          (key === "properties" || key === "controls") &&
          child &&
          typeof child === "object" &&
          !Array.isArray(child)
        ) {
          for (const field of plainKeys(child, at))
            visit((child as Record<string, unknown>)[field], depth + 1);
        } else
          visit(
            child,
            depth + 1,
            data || key === "props" || key === "before" || key === "after",
            key,
          );
      }
    ancestors.delete(item);
  };
  visit(value, 0);
}
