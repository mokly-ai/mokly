import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detailPairs,
  indexFixture,
  rawDetailFixtures,
} from "./catalogue_v9_fixture.js";
import { withDarkViews } from "./presentation_v7_helpers.js";
import { standaloneMarkup } from "./shell_markup.js";

const SCREEN = "product/browse/home";

/** Home offers Dark, and only its mobile dark view changed since the branch point. */
const index = indexFixture((model) => {
  const screen = model.screens.find((entry) => entry.path === SCREEN)!;
  screen.colorSchemes = ["light", "dark"];
  screen.changes = { status: "ready", kind: "changed", included: true };
  screen.views = withDarkViews(screen.views).map((view) => ({
    ...view,
    comparison:
      view.viewport === "mobile" && view.colorScheme === "dark"
        ? { status: "ready", kind: "changed", eligible: true }
        : { status: "ready", kind: "unmodified", eligible: false },
  }));
});
const fixtures = rawDetailFixtures();
const detail = fixtures.current[SCREEN]!;
detail.views = withDarkViews(detail.views);
const details = detailPairs(undefined, fixtures);

function render(colorScheme: "light" | "dark", home = false): string {
  return standaloneMarkup({
    index,
    details,
    initialState: { colorScheme },
    path: home ? "/" : `/view/${SCREEN}/`,
  });
}

test("standalone Appearance retains hidden-view change evidence", () => {
  const html = render("light");
  const appearance = html.match(
    /<label class="mbk-appearance"[\s\S]*?<\/label>/,
  )?.[0];
  assert.ok(appearance);
  assert.match(appearance, /data-view-changed="scheme"(?! hidden)/);
  assert.match(appearance, /aria-describedby="mb-view-changed-scheme"/);
  assert.match(appearance, /Other theme changed/);
  assert.doesNotMatch(html, /data-workspace-scheme/);

  for (const unmarked of [render("dark"), render("light", true)]) {
    const control = unmarked.match(
      /<label class="mbk-appearance"[\s\S]*?<\/label>/,
    )?.[0];
    assert.ok(control);
    assert.match(control, /data-view-changed="scheme" hidden=""/);
    assert.doesNotMatch(control, /aria-describedby/);
  }
});
