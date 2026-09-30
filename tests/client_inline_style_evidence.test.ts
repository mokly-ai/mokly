import assert from "node:assert/strict";
import test from "node:test";

import { renderEvidence } from "./helpers/style_evidence.js";

const SHARED = "mockups/shared.css";

test("linked exclusions precede excluded page styles and the terminal line", () => {
  const markup = renderEvidence({
    excluded: [SHARED],
    inlineStyles: { status: "excluded" },
    status: "Unmodified",
  });
  assert.ok(
    markup.includes(
      "<p>This stylesheet changed, but none of the changed styles apply to this screen.</p>" +
        "<p>Examined and excluded:</p>" +
        `<ul><li>${SHARED}</li></ul>` +
        "<p>Styles on this page changed, but none of the changed styles apply to this screen.</p>" +
        "<p>No changes to this screen.</p>",
    ),
  );
});

test("excluded page styles use the saved-view terminal copy", () => {
  const markup = renderEvidence({
    inlineStyles: { status: "excluded" },
    status: "Unmodified",
    variant: true,
  });
  assert.match(
    markup,
    /Styles on this page changed, but none of the changed styles apply to this variant\.<\/p><p>No changes to this saved view\./,
  );
  assert.doesNotMatch(markup, /No changes to this screen\./);
});

test("the shared-component note requires an affected component", () => {
  const excluded = renderEvidence({
    inlineStyles: { status: "excluded" },
    status: "Unmodified",
  });
  assert.doesNotMatch(excluded, /Shared component changes affect this preview/);
  assert.match(
    renderEvidence({ affected: true, status: "Unmodified" }),
    /Shared component changes affect this preview\. This page has no independent entry in Changes\./,
  );
});
