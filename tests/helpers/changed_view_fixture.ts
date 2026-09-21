import type { ReviewResultV3 } from "../../packages/viewer/dist/review/component_types.js";
import type { ViewReview } from "../../packages/viewer/dist/review/types.js";

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
export function secondVariantDarkOnlyResult(): ReviewResultV3 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["entries/fixture.mockup.tsx"],
    changes: [],
    components: [
      {
        dependencies: [],
        id: "action",
        route: "components/action.html",
        sharedImpact: [],
        state: "changed",
        title: "Action",
        variants: [
          {
            id: "default",
            state: "unchanged",
            title: "Default",
            views: variantViews(false),
          },
          {
            id: "disabled",
            state: "changed",
            title: "Disabled",
            views: variantViews(true),
          },
        ],
      },
    ],
    ignoredImpact: [],
    schemaVersion: 3,
    screens: [],
    sharedImpact: [],
  };
}
