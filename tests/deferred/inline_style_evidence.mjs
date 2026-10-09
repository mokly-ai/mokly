/** Deferred to Milestone 17; restore these cases to unit discovery with the UI. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  excludedPageStyles,
  styleOutcomes,
} from "../../packages/viewer/dist/shell/workspace_style_evidence.js";
import { fixtureCssAnalysis } from "../helpers/css_evidence.js";
const SHARED = "mockups/shared.css";

test("inline selectors join the existing outcome groups", () => {
  const views = [
    {
      colorScheme: "light",
      ignoredIds: [],
      inlineStyles: { status: "matched", selectors: ["main a", ".auth"] },
      material: true,
      state: "changed",
      viewport: "mobile",
    },
    {
      colorScheme: "dark",
      ignoredIds: [],
      inlineStyles: { status: "unresolved", selectors: [":root"] },
      material: true,
      state: "changed",
      viewport: "mobile",
    },
  ];
  assert.deepEqual(
    styleOutcomes(
      [
        {
          kind: "dependency",
          path: SHARED,
          analysis: fixtureCssAnalysis("matched", [".auth"]),
        },
      ],
      views,
    ),
    [
      { status: "matched", selectors: [".auth", "main a"] },
      { status: "unresolved", selectors: [":root"] },
    ],
  );
});

test("excluded page styles yield only when no inline style is retained", () => {
  const view = (inlineStyles) => ({
    colorScheme: "light",
    ignoredIds: [],
    ...(inlineStyles ? { inlineStyles } : {}),
    ...(inlineStyles && inlineStyles.status !== "excluded"
      ? { material: true }
      : {}),
    state: inlineStyles?.status === "excluded" ? "unchanged" : "changed",
    viewport: "mobile",
  });
  assert.equal(excludedPageStyles([view({ status: "excluded" })]), true);
  assert.equal(
    excludedPageStyles([
      view({ status: "excluded" }),
      view({ status: "matched", selectors: [".entry"] }),
    ]),
    false,
  );
  assert.equal(
    excludedPageStyles([
      view({ status: "excluded" }),
      view({ status: "unresolved", selectors: [] }),
    ]),
    false,
  );
  assert.equal(excludedPageStyles([view(undefined)]), false);
});
