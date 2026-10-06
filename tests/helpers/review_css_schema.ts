import type {
  ReviewResult,
  ViewReview,
} from "../../packages/viewer/dist/review/types.js";

/** Snapshot closure for both valid schema fixtures. */
export function cssSchemaFiles(): Map<string, string> {
  return new Map(
    ["before", "after"].flatMap(
      (side) =>
        [
          [`snapshots/${side}/shared.css`, ".auth { color: red; }"],
          [
            `snapshots/${side}/auth/index.mobile.html`,
            `<!doctype html><link rel="stylesheet" href="../shared.css"><button class="auth">${side === "before" ? "Sign in" : "Continue"}</button>`,
          ],
          [
            `snapshots/${side}/auth/index.desktop.html`,
            '<!doctype html><link rel="stylesheet" href="../shared.css"><p>Guide</p>',
          ],
        ] as [string, string][],
    ),
  );
}

/** Shared server/browser schema fixture uses the path-based v5 result. */
export function cssSchemaFixture(_version: 5 = 5): ReviewResult {
  const address = { path: "auth", title: "Sign in" };
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
          analysis: { status: "matched", selectors: [".auth", ".button"] },
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
    sharedImpact: ["mockups/shared.css"],
  };
  const screen = {
    ...address,
    dependencies: [],
    sharedImpact: ["mockups/shared.css"],
    state: "changed" as const,
    views,
  };
  return {
    ...common,
    schemaVersion: 5 as const,
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
