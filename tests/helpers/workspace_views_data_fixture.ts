import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import type { ManifestV6 } from "../../packages/viewer/dist/registry/types.js";
import type { ReviewResultV5 } from "../../packages/viewer/dist/review/component_types.js";
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
  description: "Badge component",
  id: "badge",
  kind: "component",
  navPath: [],
  propSchema: { kind: "object", properties: {} },
  relatedDocs: [],
  route: "components/badge.html",
  slots: [],
  sourcePath: "entries/badge.mockup.tsx",
  title: "Badge",
  variants: [DEFAULT_VARIANT, SECOND_VARIANT],
  viewports: ["mobile", "desktop"],
};

export const componentManifest: ManifestV6 = {
  entries: [component],
  generatedBy: "mokly",
  schemaVersion: 6,
  sourceFiles: [component.sourcePath],
};

export const componentBaseline: ManifestV6 = {
  ...componentManifest,
  entries: [
    {
      ...component,
      variants: [DEFAULT_VARIANT, SECOND_VARIANT, REMOVED_VARIANT],
    },
  ],
};

export const screen = {
  darkFragments: {
    desktop: "screens/welcome.desktop.dark.html",
    mobile: "screens/welcome.mobile.dark.html",
  },
  description: "Landing screen",
  fragments: {
    desktop: "screens/welcome.desktop.html",
    mobile: "screens/welcome.mobile.html",
  },
  id: "welcome",
  kind: "screen",
  navPath: [],
  relatedDocs: [],
  route: "screens/welcome.html",
  sourcePath: "entries/fixture.mockup.tsx",
  title: "Welcome",
  useCaseIds: [],
  viewports: ["mobile", "desktop"],
} as const;

export const screenManifest: ManifestV6 = {
  entries: [screen],
  generatedBy: "mokly",
  schemaVersion: 6,
  sourceFiles: [screen.sourcePath],
};

/** A v3 comparison whose only material difference is in dark renders. */
export function darkOnlyResult(state: "changed" | "unchanged"): ReviewResultV5 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["mockups/styles.css"],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 5,
    screens: [
      {
        id: screen.id,
        route: screen.route,
        state,
        title: screen.title,
        views: views("changed"),
      },
    ],
  };
}

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

export function componentVariantResult(): ReviewResultV5 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["entries/badge.mockup.tsx"],
    changes: [],
    components: [
      {
        id: component.id,
        route: component.route,
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
    schemaVersion: 5,
    screens: [],
  };
}
