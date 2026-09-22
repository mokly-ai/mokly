import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { ViewerRouting } from "../src/viewer/routing.js";
import { defaultSelection } from "../src/viewer/selection.js";
import type { ViewerSelection } from "../src/viewer/types.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);

test("legacy shell routing parses valid explicit axes independently", () => {
  const selection = { ...defaultSelection, screenId: "home" };
  const proposals: Partial<ViewerSelection>[] = [];
  const routing = new ViewerRouting(
    model,
    new URL("https://catalogue.example"),
    actions(selection, proposals),
  );

  routing.shell(
    "home",
    new URL(
      "https://catalogue.example/view/screens/home.html?viewport=desktop&scheme=dark",
    ),
  );
  routing.shell(
    "action",
    new URL(
      "https://catalogue.example/view/components/action.html?viewport=invalid&scheme=dark",
    ),
  );
  routing.shell(
    "action",
    new URL(
      "https://catalogue.example/view/components/action.html?viewport=mobile&scheme=light&scheme=dark",
    ),
  );

  assert.deepEqual(proposals, [
    {
      screenId: "home",
      variantId: undefined,
      viewport: "desktop",
      colorScheme: "dark",
    },
    { screenId: "action", variantId: undefined, colorScheme: "dark" },
    { screenId: "action", variantId: undefined, viewport: "mobile" },
  ]);
});

function actions(
  selection: ViewerSelection,
  proposals: Partial<ViewerSelection>[],
) {
  return {
    selection: () => selection,
    select: (value: Partial<ViewerSelection>) => proposals.push(value),
    refresh: () => undefined,
    endPick: () => undefined,
    open: () => undefined,
    events: () => ({}),
  };
}
