import { denseArray, invalidData, plainKeys } from "../components/data.js";

import { repositoryPath } from "./values.js";

const PRIVATE_KEYS = new Set([
  "sourceFiles",
  "declaredDependencies",
  "ownedDependencies",
  "startOffset",
  "endOffset",
  "styles",
  "resources",
  "legacyPages",
  "legacyManifest",
  "manifest",
  "baseline",
  "changedPaths",
  "headDigests",
  "sourceGraph",
  "renderCapability",
  "resolvedDependencies",
  "dependencyEvidence",
  "baselineManifest",
  "legacyManifests",
  "sourceMaps",
  "gitCommands",
  "styleOwnership",
  "resourceOwnership",
  "credentials",
  "token",
  "authorization",
  "cookies",
]);

/** Unknown extensions stay additive but cannot smuggle private evidence or paths. */
export function assertPublicCatalogue(value: unknown): void {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number, data = false): void => {
    if (++nodes > 5_000_000 || depth > 128)
      invalidData("$catalogue", "public data limit exceeded");
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item))
    )
      return;
    if (typeof item !== "object" || item === null || ancestors.has(item))
      invalidData("$catalogue", "expected acyclic JSON data");
    ancestors.add(item);
    if (Array.isArray(item)) {
      denseArray(item, "$catalogue");
      for (const child of item) visit(child, depth + 1, data);
    } else
      for (const key of plainKeys(item, "$catalogue")) {
        const child = (item as Record<string, unknown>)[key];
        if (!data && PRIVATE_KEYS.has(key))
          invalidData(
            "$catalogue",
            "private evidence is not public catalogue data",
          );
        if (!data && /(?:Path$|^path$)/.test(key) && typeof child === "string")
          repositoryPath(child);
        if (
          !data &&
          (key === "properties" || key === "controls") &&
          child &&
          typeof child === "object" &&
          !Array.isArray(child)
        ) {
          for (const field of plainKeys(child, "$catalogue"))
            visit((child as Record<string, unknown>)[field], depth + 1);
        } else visit(child, depth + 1, data || key === "props");
      }
    ancestors.delete(item);
  };
  visit(value, 0);
}
