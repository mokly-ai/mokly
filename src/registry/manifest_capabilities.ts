import type { Manifest } from "@mokly/viewer/data";

/** Component-aware attribution is selected by recorded components, not version alone. */
export function hasRegisteredComponents(manifest: Manifest): boolean {
  return manifest.entries.some((entry) => entry.kind === "component");
}
