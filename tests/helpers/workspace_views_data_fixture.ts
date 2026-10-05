import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import type { ManifestV8 } from "../../packages/viewer/dist/registry/types.js";
import type { ReviewResultV5 } from "../../packages/viewer/dist/review/component_types.js";
import type { ViewReview } from "../../packages/viewer/dist/review/types.js";

function variant(id: string, title: string): ManifestComponentVariant {
  return {
    colorSchemes: ["light", "dark"],
    componentViews: [],

    description: `${title} badge`,
    path: id,
    kind: "component",

    props: {},
    relatedDocs: [],
    sourcePath: "entries/badge.mockup.tsx",
    suppliedSlots: [],
    title,
    variantOf: "badge",
  };
}

export const DEFAULT_VARIANT = variant("badge/default", "Default");
export const SECOND_VARIANT = variant("badge/second", "Second");
export const REMOVED_VARIANT = variant("badge/removed", "Removed");

export const component: ManifestComponent = {
  colorSchemes: ["light", "dark"],
  controls: {},
  description: "Badge component",
  path: "badge",
  kind: "component",

  propSchema: { kind: "object", properties: {} },
  relatedDocs: [],
  slots: [],
  sourcePath: "entries/badge.mockup.tsx",
  title: "Badge",
};

export const componentManifest: ManifestV8 = {
  entries: [component, DEFAULT_VARIANT, SECOND_VARIANT],
  generatedBy: "mokly",
  schemaVersion: 8 as const,
  folders: [],
  sourceFiles: [component.sourcePath],
};

export const componentBaseline: ManifestV8 = {
  ...componentManifest,
  entries: [component, DEFAULT_VARIANT, SECOND_VARIANT, REMOVED_VARIANT],
};

export const screen = {
  colorSchemes: ["light", "dark"],
  description: "Landing screen",
  path: "welcome",
  kind: "screen",

  relatedDocs: [],
  sourcePath: "entries/fixture.mockup.tsx",
  title: "Welcome",
  useCasePaths: [],
} as const;

export const screenManifest: ManifestV8 = {
  entries: [screen],
  generatedBy: "mokly",
  schemaVersion: 8 as const,
  folders: [],
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
    schemaVersion: 5 as const,
    screens: [
      {
        after: { path: screen.path, title: screen.title },
        before: { path: screen.path, title: screen.title },
        path: screen.path,
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
        after: { path: component.path, title: component.title },
        before: { path: component.path, title: component.title },
        path: component.path,
        state: "changed",
        title: component.title,
        variants: [
          {
            after: variantAddress(DEFAULT_VARIANT),
            before: variantAddress(DEFAULT_VARIANT),
            path: DEFAULT_VARIANT.path,
            state: "unchanged",
            title: DEFAULT_VARIANT.title,
            views: views("unchanged"),
          },
          {
            after: variantAddress(SECOND_VARIANT),
            before: variantAddress(SECOND_VARIANT),
            path: SECOND_VARIANT.path,
            state: "changed",
            title: SECOND_VARIANT.title,
            views: views("changed"),
          },
          {
            before: variantAddress(REMOVED_VARIANT),
            path: REMOVED_VARIANT.path,
            state: "removed",
            title: REMOVED_VARIANT.title,
            views: views("removed", "removed"),
          },
        ],
      },
    ],
    ignoredImpact: [],
    schemaVersion: 5 as const,
    screens: [],
  };
}

function variantAddress(variant: ManifestComponentVariant) {
  return {
    path: variant.path,
    title: variant.title,
    props: variant.props,
    suppliedSlots: variant.suppliedSlots,
  };
}
