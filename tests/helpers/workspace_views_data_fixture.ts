import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import type { ManifestV8 } from "../../packages/viewer/dist/registry/types.js";
import type { ReviewResultV4 } from "../../packages/viewer/dist/review/component_types.js";
import type { ViewReview } from "../../packages/viewer/dist/review/types.js";

import { currentManifest } from "./current_manifest.js";

function variant(id: string, title: string): ManifestComponentVariant {
  return {
    colorSchemes: ["light", "dark"],
    componentViews: [],
    declaredDependencies: [],
    description: `${title} badge`,
    id,
    kind: "component",
    navPath: [],
    props: {},
    relatedDocs: [],
    sourcePath: "entries/badge.mockup.tsx",
    suppliedSlots: [],
    title,
    variantOf: "badge",
  };
}

export const DEFAULT_VARIANT = variant("badge-default", "Default");
export const SECOND_VARIANT = variant("badge-second", "Second");
export const REMOVED_VARIANT = variant("badge-removed", "Removed");

export const component: ManifestComponent = {
  colorSchemes: ["light", "dark"],
  controls: {},
  declaredDependencies: [],
  description: "Badge component",
  id: "badge",
  kind: "component",
  navPath: [],
  ownedDependencies: [],
  propSchema: { kind: "object", properties: {} },
  relatedDocs: [],
  slots: [],
  sourcePath: "entries/badge.mockup.tsx",
  title: "Badge",
};

export const componentManifest: ManifestV8 = currentManifest({
  entries: [component, DEFAULT_VARIANT, SECOND_VARIANT],
  generatedBy: "mokly",
  schemaVersion: 8,
  sourceFiles: [component.sourcePath],
});

export const componentBaseline: ManifestV8 = {
  ...componentManifest,
  entries: [component, DEFAULT_VARIANT, SECOND_VARIANT, REMOVED_VARIANT],
};

export const screen = {
  colorSchemes: ["light", "dark"],
  declaredDependencies: [],
  description: "Landing screen",
  id: "welcome",
  kind: "screen",
  navPath: [],
  relatedDocs: [],
  sourcePath: "entries/fixture.mockup.tsx",
  title: "Welcome",
  useCaseIds: [],
} as const;

export const screenManifest: ManifestV8 = currentManifest({
  entries: [screen],
  generatedBy: "mokly",
  schemaVersion: 8,
  sourceFiles: [screen.sourcePath],
});

/** A v3 comparison whose only material difference is in dark renders. */
export function darkOnlyResult(state: "changed" | "unchanged"): ReviewResultV4 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["mockups/styles.css"],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 4,
    screens: [
      {
        after: { id: screen.id, title: screen.title },
        before: { id: screen.id, title: screen.title },
        dependencies: [],
        id: screen.id,
        sharedImpact: [],
        state,
        title: screen.title,
        views: views("changed"),
      },
    ],
    sharedImpact: [],
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

export function componentVariantResult(): ReviewResultV4 {
  return {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: ["entries/badge.mockup.tsx"],
    changes: [],
    components: [
      {
        after: { id: component.id, title: component.title },
        before: { id: component.id, title: component.title },
        dependencies: [],
        id: component.id,
        sharedImpact: [],
        state: "changed",
        title: component.title,
        variants: [
          {
            after: variantAddress(DEFAULT_VARIANT),
            before: variantAddress(DEFAULT_VARIANT),
            id: DEFAULT_VARIANT.id,
            state: "unchanged",
            title: DEFAULT_VARIANT.title,
            views: views("unchanged"),
          },
          {
            after: variantAddress(SECOND_VARIANT),
            before: variantAddress(SECOND_VARIANT),
            id: SECOND_VARIANT.id,
            state: "changed",
            title: SECOND_VARIANT.title,
            views: views("changed"),
          },
          {
            before: variantAddress(REMOVED_VARIANT),
            id: REMOVED_VARIANT.id,
            state: "removed",
            title: REMOVED_VARIANT.title,
            views: views("removed", "removed"),
          },
        ],
      },
    ],
    ignoredImpact: [],
    schemaVersion: 4,
    screens: [],
    sharedImpact: [],
  };
}

function variantAddress(variant: ManifestComponentVariant) {
  return {
    id: variant.id,
    title: variant.title,
    props: variant.props,
    suppliedSlots: variant.suppliedSlots,
  };
}
