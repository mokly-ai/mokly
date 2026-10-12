import assert from "node:assert/strict";
import test from "node:test";

import { styleOutcomes } from "../../packages/viewer/dist/shell/workspace_style_evidence.js";
const SHARED = "mockups/shared.css";
const TOKENS = "mockups/tokens.css";
test("analysed reasons group into one list per retained outcome", () => {
  const outcomes = styleOutcomes([
    { kind: "material" },
    { kind: "dependency", path: "mockups/logo.svg" },
    {
      kind: "dependency",
      path: SHARED,
      analysis: { status: "matched", selectors: ["main a", ".auth"] },
    },
    {
      kind: "dependency",
      path: TOKENS,
      analysis: { status: "matched", selectors: [".auth"] },
    },
    {
      kind: "dependency",
      path: "mockups/root.css",
      analysis: { status: "unresolved", selectors: [":root"] },
    },
  ]);
  assert.deepEqual(outcomes, [
    { status: "matched", selectors: [".auth", "main a"] },
    { status: "unresolved", selectors: [":root"] },
  ]);
  assert.deepEqual(styleOutcomes(undefined), []);
});
