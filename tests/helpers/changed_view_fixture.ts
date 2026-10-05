import type { ReviewResultV5 } from "../../packages/viewer/dist/review/component_types.js";
import type { ViewReview } from "../../packages/viewer/dist/review/types.js";
import type { ScreenViewChanges } from "../../packages/viewer/dist/shell/metadata.js";

const HOME = "fixture/screens/home";

/** Only Home's dark renders differ; every light view stays unchanged. */
export function darkOnlyScreenViews(): readonly ScreenViewChanges[] {
  return [
    {
      path: HOME,
      views: [
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "mobile", colorScheme: "dark", state: "changed" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        { viewport: "desktop", colorScheme: "dark", state: "changed" },
      ],
    },
    {
      path: "fixture/screens/details",
      views: [
        { viewport: "mobile", colorScheme: "light", state: "unchanged" },
        { viewport: "mobile", colorScheme: "dark", state: "unchanged" },
        { viewport: "desktop", colorScheme: "light", state: "unchanged" },
        { viewport: "desktop", colorScheme: "dark", state: "unchanged" },
      ],
    },
  ];
}

function variantViews(changed: boolean): readonly ViewReview[] {
  return (["mobile", "desktop"] as const).flatMap((viewport) =>
    (["light", "dark"] as const).map((colorScheme) => ({
      colorScheme,
      ignoredIds: [],
      state: changed && colorScheme === "dark" ? "changed" : "unchanged",
      viewport,
    })),
  );
}

/** Component comparison where only the second saved variant changed in dark. */
export function secondVariantDarkOnlyResult(): ReviewResultV5 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["entries/fixture.mockup.tsx"],
    changes: [],
    components: [
      {
        after: { path: "action", title: "Action" },
        before: { path: "action", title: "Action" },
        dependencies: [],
        path: "action",
        sharedImpact: [],
        state: "changed",
        title: "Action",
        variants: [
          {
            after: {
              path: "action/default",
              title: "Default",
              props: {},
              suppliedSlots: [],
            },
            before: {
              path: "action/default",
              title: "Default",
              props: {},
              suppliedSlots: [],
            },
            path: "action/default",
            state: "unchanged",
            title: "Default",
            views: variantViews(false),
          },
          {
            after: {
              path: "action/disabled",
              title: "Disabled",
              props: {},
              suppliedSlots: [],
            },
            before: {
              path: "action/disabled",
              title: "Disabled",
              props: {},
              suppliedSlots: [],
            },
            path: "action/disabled",
            state: "changed",
            title: "Disabled",
            views: variantViews(true),
          },
        ],
      },
    ],
    ignoredImpact: [],
    schemaVersion: 5 as const,
    screens: [],
    sharedImpact: [],
  };
}
