import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";

test("an image in an excluded inline rule creates no Changes row", async (t) => {
  const styles = '<style>.unused{background:url("../image.svg")}</style>';
  const fixture = await inlineChangesFixture(t, styles, styles, {
    files: {
      before: {
        "image.svg": "before-image",
        "components/image.svg": "component-image",
      },
      after: {
        "image.svg": "after-image",
        "components/image.svg": "component-image",
      },
    },
  });
  const [live, { result }] = await Promise.all([
    fixture.live(),
    fixture.complete(),
  ]);
  assert.deepEqual(live.changedEntries, []);
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  assert.deepEqual(result.changes, []);
  assert.ok(
    result.screens.every((screen) =>
      screen.views.every(
        (view) =>
          view.state === "unchanged" &&
          !view.reasons &&
          !view.excludedResources &&
          !view.inlineStyles,
      ),
    ),
  );
});

test("a string-form inline import stays unresolved entry material", async (t) => {
  const styles = '<style>@import "../theme.css";</style>';
  const fixture = await inlineChangesFixture(t, styles, styles, {
    files: {
      before: {
        "theme.css": ".entry{color:red}",
        "components/theme.css": ".saved{color:red}",
      },
      after: {
        "theme.css": ".entry{color:blue}",
        "components/theme.css": ".saved{color:red}",
      },
    },
  });
  const { result } = await fixture.complete();
  assert.equal(result.schemaVersion, 6);
  if (result.schemaVersion !== 6) return;
  const screen = result.changes.find((entry) => entry.after?.path === "home");
  assert.deepEqual(screen?.reasons, [
    {
      kind: "dependency",
      path: "mockups/theme.css",
      analysis: { status: "matched", selectors: [".entry"] },
    },
  ]);
  assert.ok(!result.changes.some((entry) => entry.kind === "component"));
  assert.ok(
    result.screens
      .find((entry) => entry.path === "home")!
      .views.every((view) => !view.inlineStyles),
  );
});
