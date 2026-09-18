import assert from "node:assert/strict";

import type { Compilation } from "../../dist/build/compile.js";
import type { ComponentViewRecord } from "../../packages/viewer/dist/components/manifest_types.js";
import type { Manifest } from "../../packages/viewer/dist/registry/types.js";

/** Every actual screen and saved-variant view, in its own entry scope. */
export function componentViews(manifest: Manifest): ComponentViewRecord[] {
  return manifest.entries.flatMap((entry) =>
    entry.kind === "screen"
      ? [...(entry.componentViews ?? [])]
      : entry.kind === "component"
        ? entry.variants.flatMap((variant) => [...variant.componentViews])
        : [],
  );
}

export function screenView(compilation: Compilation): ComponentViewRecord {
  const screen = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen",
  );
  assert.ok(screen?.componentViews?.[0]);
  return screen.componentViews[0];
}
