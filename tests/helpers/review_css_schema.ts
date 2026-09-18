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
            `snapshots/${side}/mobile.html`,
            `<!doctype html><link rel="stylesheet" href="shared.css"><button class="auth">${side === "before" ? "Sign in" : "Continue"}</button>`,
          ],
          [
            `snapshots/${side}/desktop.html`,
            '<!doctype html><link rel="stylesheet" href="shared.css"><p>Guide</p>',
          ],
        ] as [string, string][],
    ),
  );
}

/** Shared server/browser schema fixtures retain both historical versions. */
export function cssSchemaFixture(version: 2 | 3): ReviewResult {
  const address = { id: "auth", route: "screens/auth.html", title: "Sign in" };
  const views: ViewReview[] = [
    {
      viewport: "mobile",
      colorScheme: "light",
      state: "changed",
      material: true,
      ignoredIds: [],
      beforePath: "snapshots/before/mobile.html",
      afterPath: "snapshots/after/mobile.html",
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
      beforePath: "snapshots/before/desktop.html",
      afterPath: "snapshots/after/desktop.html",
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
  return version === 2
    ? { ...common, schemaVersion: 2, screens: [screen] }
    : {
        ...common,
        schemaVersion: 3,
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
