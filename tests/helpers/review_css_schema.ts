import type {
  ReviewResult,
  ViewReview,
} from "../../packages/viewer/dist/review/types.js";

import { fixtureCssAnalysis } from "./css_evidence.js";

/** Snapshot closure for both valid schema fixtures. */
export function cssSchemaFiles(): Map<string, string> {
  return new Map(
    ["before", "after"].flatMap(
      (side) =>
        [
          [`snapshots/${side}/shared.css`, ".auth { color: red; }"],
          [
            `snapshots/${side}/screens/auth.mobile.html`,
            `<!doctype html><link rel="stylesheet" href="../shared.css"><button class="auth">${side === "before" ? "Sign in" : "Continue"}</button>`,
          ],
          [
            `snapshots/${side}/screens/auth.desktop.html`,
            '<!doctype html><link rel="stylesheet" href="../shared.css"><p>Guide</p>',
          ],
        ] as [string, string][],
    ),
  );
}

/** Shared server/browser schema fixture uses the identity-only v5 result. */
export function cssSchemaFixture(): ReviewResult {
  const address = { id: "auth", title: "Sign in" };
  const views: ViewReview[] = [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "changed",
      material: true,
      ignoredIds: [],
      reasons: [
        {
          kind: "dependency",
          path: "mockups/shared.css",
          analysis: fixtureCssAnalysis("matched", [".auth", ".button"]),
        },
      ],
    },
    {
      viewport: "desktop",
      colorScheme: "light",
      state: "unchanged",
      ignoredIds: [],
      excludedResources: [
        { path: "mockups/shared.css", reason: "no-matching-rule" },
      ],
    },
  ];
  const common = {
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["mockups/shared.css"],
    ignoredImpact: [],
  };
  const screen = {
    ...address,
    state: "changed" as const,
    views,
  };
  return {
    ...common,
    schemaVersion: 5,
    screens: [{ ...screen, before: address, after: address }],
    components: [],
    affectedConsumers: [],
    changes: [
      {
        kind: "screen",
        before: address,
        after: address,
        reasons: views[0]!.reasons!,
      },
    ],
  };
}
