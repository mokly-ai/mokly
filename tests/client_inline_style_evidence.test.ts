import assert from "node:assert/strict";
import test from "node:test";

import { renderEvidence } from "./helpers/style_evidence.js";

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
