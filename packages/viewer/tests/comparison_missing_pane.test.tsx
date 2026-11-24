import assert from "node:assert/strict";
import { test } from "node:test";

import type { ViewRouteKind } from "../src/navigation/routes.js";
import type { ComparisonScrollSync } from "../src/shell/comparison_scroll_types.js";
import { SideComparisonFrame } from "../src/shell/comparison_side.js";
import { entryWording } from "../src/shell/entry_wording.js";

import { storeMarkup } from "./shell_markup.js";

/** The messages of Side by side's two frames with neither document present. */
function missingMessages(kind: ViewRouteKind): string[] {
  const markup = storeMarkup(
    <>
      {(["before", "after"] as const).map((side) => (
        <SideComparisonFrame
          cell={{
            column: 0,
            kind: "desktop",
            label: "Desktop · Light",
            name: "Desktop · Light",
            row: 0,
            scheme: "light",
            size: { height: 800, width: 1280 },
          }}
          document={undefined}
          key={side}
          side={side}
          sync={{} as ComparisonScrollSync}
          wording={entryWording(kind)}
        />
      ))}
    </>,
  );
  return [
    ...markup.matchAll(/<p class="mb-pane-missing mbk-reset">([^<]*)<\/p>/g),
  ].map((match) => match[1]!);
}

test("a missing pane uses the design catalogue's copy for its entry kind", () => {
  assert.deepEqual(missingMessages("component"), [
    "This variant did not exist before.",
    "This variant has been removed.",
  ]);
  assert.deepEqual(missingMessages("screen"), [
    "This screen did not exist before.",
    "This screen has been removed.",
  ]);
});
