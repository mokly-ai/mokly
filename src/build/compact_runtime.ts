/** Worker transfer never includes unrelated rendered HTML or usage evidence. */
import { isManifestComponentVariant } from "@mokly/viewer/data";

import type { ComponentRuntime } from "./component_runtime.js";

export function compactRuntime(runtime: ComponentRuntime): ComponentRuntime {
  if (runtime.manifest.schemaVersion === "live-index-1") return runtime;
  return {
    ...runtime,
    outputs: [],
    manifest: {
      ...runtime.manifest,
      schemaVersion: "live-index-1",
      entries: runtime.manifest.entries.map((entry) => {
        if (entry.kind === "screen") {
          const { componentViews: _usage, ...metadata } = entry;
          return {
            ...metadata,
            interactive: interactiveEntry(runtime, entry.path),
          };
        }
        if (entry.kind === "component" && isManifestComponentVariant(entry))
          return {
            ...entry,
            interactive: interactiveEntry(runtime, entry.path),
            componentViews: [],
          };
        if (entry.kind === "component")
          return {
            ...entry,
            interactive: interactiveEntry(runtime, entry.path),
          };
        return entry;
      }),
    },
  };
}

function interactiveEntry(runtime: ComponentRuntime, id: string): boolean {
  const value = runtime.interactiveEntries[id];
  if (typeof value !== "boolean")
    throw new Error(`Component runtime is missing Live eligibility for ${id}`);
  return value;
}
