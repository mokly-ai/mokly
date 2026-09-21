import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import type { ManifestV5 } from "../../packages/viewer/dist/registry/types.js";
import type { ReviewResultV3 } from "../../packages/viewer/dist/review/component_types.js";
import type { ViewReview } from "../../packages/viewer/dist/review/types.js";

function variant(id: string, title: string): ManifestComponentVariant {
  const stem = `components/badge.variants/${id}`;
  return {
    componentViews: [],
    darkFragments: {
      desktop: `${stem}.desktop.dark.html`,
      mobile: `${stem}.mobile.dark.html`,
    },
    fragments: {
      desktop: `${stem}.desktop.html`,
      mobile: `${stem}.mobile.html`,
    },
    id,
    props: {},
    suppliedSlots: [],
    title,
  };
}

export const DEFAULT_VARIANT = variant("default", "Default");
export const SECOND_VARIANT = variant("second", "Second");
export const REMOVED_VARIANT = variant("removed", "Removed");

export const component: ManifestComponent = {
  controls: {},
  declaredDependencies: [],
  dependencies: [],
  description: "Badge component",
  id: "badge",
  kind: "component",
  navPath: [],
  ownedDependencies: [],
  propSchema: { kind: "object", properties: {} },
  relatedDocs: [],
  route: "components/badge.html",
  slots: [],
  sourcePath: "entries/badge.mockup.tsx",
  title: "Badge",
  variants: [DEFAULT_VARIANT, SECOND_VARIANT],
  viewports: ["mobile", "desktop"],
};

export const componentManifest: ManifestV5 = {
  entries: [component],
  generatedBy: "mokly",
  schemaVersion: 5,
  sourceFiles: [component.sourcePath],
};

export const componentBaseline: ManifestV5 = {
  ...componentManifest,
  entries: [
    {
      ...component,
      variants: [DEFAULT_VARIANT, SECOND_VARIANT, REMOVED_VARIANT],
    },
  ],
};

function views(
  dark: ViewReview["state"],
  light: ViewReview["state"] = "unchanged",
): readonly ViewReview[] {
  return (["mobile", "desktop"] as const).flatMap((viewport) => [
    {
      colorScheme: "light" as const,
      ignoredIds: [],
      state: light,
      viewport,
    },
    {
      colorScheme: "dark" as const,
      ignoredIds: [],
      state: dark,
      viewport,
    },
  ]);
}

export function componentVariantResult(): ReviewResultV3 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["entries/badge.mockup.tsx"],
    changes: [],
    components: [
      {
        dependencies: [],
        id: component.id,
        route: component.route,
        sharedImpact: [],
        state: "changed",
        title: component.title,
        variants: [
          {
            id: DEFAULT_VARIANT.id,
            state: "unchanged",
            title: DEFAULT_VARIANT.title,
            views: views("unchanged"),
          },
          {
            id: SECOND_VARIANT.id,
            state: "changed",
            title: SECOND_VARIANT.title,
            views: views("changed"),
          },
          {
            id: REMOVED_VARIANT.id,
            state: "removed",
            title: REMOVED_VARIANT.title,
            views: views("removed", "removed"),
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
