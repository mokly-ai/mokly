import assert from "node:assert/strict";

import type { designLibraryFixture } from "./design_library_fixture.js";

export const selectors: Record<string, string> = {
  "top-bar": ".mbk-topbar",
  "catalogue-navigation": ".mbk-nav",
  "screen-header": ".mbk-screen-head",
  "appearance-selector": ".mbk-appearance",
  "comparison-toolbar": ".mbk-cmp-toolbar",
  "view-controls": ".ce-view-controls",
  "tag-picker": ".mbk-tag-picker",
  "tag-chip": ".mbk-chip.tag",
  "change-status": ".ce-change-status",
  inspector: ".ce-inspector",
  "metadata-row": ".mbk-meta-row",
  "prop-field": ".ce-control-row",
  "device-frame": ".mbk-frame-wrap",
  "comparison-pane": ".mbk-compare-side",
  "empty-state": ".mbk-empty",
  "flow-step": ".flow-step",
};

export function assertComponentRows(
  result: {
    changes: readonly { after?: { id: string }; before?: { id: string } }[];
  },
  fixture: Awaited<ReturnType<typeof designLibraryFixture>>,
  owners: readonly string[],
) {
  const direct = result.changes.map(
    (change) => (change.after ?? change.before)!.id,
  );
  for (const owner of owners) assert.ok(direct.includes(owner), owner);
  for (const id of direct) {
    const entry = fixture.before.manifest.entries.find(
      (entry) => entry.id === id,
    )!;
    assert.ok(
      entry.kind === "component" &&
        (owners.includes(entry.id) ||
          ("variantOf" in entry && owners.includes(entry.variantOf))),
      id,
    );
  }
  assert.ok(
    direct.length > owners.length,
    "matching saved variants have their own rows",
  );
}
