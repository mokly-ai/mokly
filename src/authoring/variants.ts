import { entryRoute } from "@mokly/viewer/data";

import { VARIANT_AUTHORING } from "./markers.js";
import type { ScreenDefinition, ScreenVariantInput } from "./types.js";

const FORBIDDEN_VARIANT_FIELDS = ["variants", "navPath"] as const;

interface VariantAuthoringMetadata {
  forbiddenFields: readonly (typeof FORBIDDEN_VARIANT_FIELDS)[number][];
}

type AuthoredVariantDefinition = ScreenDefinition & {
  [VARIANT_AUTHORING]: VariantAuthoringMetadata;
};

/** Flatten authored variants immediately after their branded parent. */
export function flattenScreenVariants(
  parent: ScreenDefinition,
  variants: readonly ScreenVariantInput[],
): readonly ScreenDefinition[] {
  return [
    parent,
    ...variants.map((variant) => variantDefinition(parent, variant)),
  ];
}

/** Read internal authoring facts retained through registry preparation. */
export function screenVariantAuthoring(
  definition: object,
): VariantAuthoringMetadata | undefined {
  return (definition as Partial<AuthoredVariantDefinition>)[VARIANT_AUTHORING];
}

function variantDefinition(
  parent: ScreenDefinition,
  variant: ScreenVariantInput,
): ScreenDefinition {
  const input = variant as ScreenVariantInput & Record<string, unknown>;
  const address = variant.address ?? parent.address;
  const colorSchemes = variant.colorSchemes ?? parent.colorSchemes;
  const tags = variant.tags ?? parent.tags;
  const definition: AuthoredVariantDefinition = {
    __viaDefine: true,
    ...(address !== undefined ? { address } : {}),
    ...(colorSchemes !== undefined ? { colorSchemes } : {}),
    dependencies: variant.dependencies ?? parent.dependencies,
    description: variant.description,
    desktop: variant.desktop,
    id: variant.id,
    kind: "screen",
    mobile: variant.mobile,
    navPath: Array.isArray(parent.navPath)
      ? [...parent.navPath]
      : parent.navPath,
    ...(variant.rationale !== undefined
      ? { rationale: variant.rationale }
      : {}),
    relatedDocs: variant.relatedDocs ?? parent.relatedDocs,
    route: entryRoute("screen", variant.id),
    ...(tags !== undefined ? { tags } : {}),
    title: variant.title,
    useCaseIds: variant.useCaseIds ?? [],
    variantOf: parent.id,
    [VARIANT_AUTHORING]: {
      forbiddenFields: FORBIDDEN_VARIANT_FIELDS.filter(
        (field) => field in input,
      ),
    },
  };
  if (parent.definedIn !== undefined) definition.definedIn = parent.definedIn;
  return definition;
}
