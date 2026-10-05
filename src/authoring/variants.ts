import { unknownFields } from "./fields.js";
import { registerDefinition } from "./identity.js";
import {
  VARIANT_AUTHORING,
  VARIANT_PARENT,
  VARIANT_INDEX,
  DEFINITION,
  DEFINITION_IDENTITY,
} from "./markers.js";
import type { ScreenDefinition, ScreenVariantInput } from "./types.js";

const FORBIDDEN_VARIANT_FIELDS = ["variants"] as const;

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
    ...variants.map((variant, index) =>
      variantDefinition(parent, variant, index),
    ),
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
  index: number,
): ScreenDefinition {
  const input = variant as ScreenVariantInput & Record<string, unknown>;
  const address = variant.address ?? parent.address;
  const colorSchemes = variant.colorSchemes ?? parent.colorSchemes;
  const tags = variant.tags ?? parent.tags;
  const removed: object = Object.hasOwn(variant, "dependencies")
    ? { dependencies: (input as { dependencies?: unknown }).dependencies }
    : {};
  const definition: AuthoredVariantDefinition = {
    ...unknownFields(variant, "screen-variant"),
    __viaDefine: true,
    ...(address !== undefined ? { address } : {}),
    ...(colorSchemes !== undefined ? { colorSchemes } : {}),
    ...removed,
    description: variant.description,
    desktop: variant.desktop,
    slug: variant.slug,
    ...(variant.movedFrom === undefined
      ? {}
      : { movedFrom: variant.movedFrom }),
    kind: "screen",
    mobile: variant.mobile,
    ...(variant.rationale !== undefined
      ? { rationale: variant.rationale }
      : {}),
    relatedDocs: variant.relatedDocs ?? parent.relatedDocs,
    ...(tags !== undefined ? { tags } : {}),
    title: variant.title,
    useCasePaths: variant.useCasePaths ?? [],
    [VARIANT_PARENT]: parent,
    [VARIANT_INDEX]: index,
    [DEFINITION]: true,
    [DEFINITION_IDENTITY]: {},
    [VARIANT_AUTHORING]: {
      forbiddenFields: FORBIDDEN_VARIANT_FIELDS.filter(
        (field) => field in input,
      ),
    },
  };
  if (parent.definedIn !== undefined) definition.definedIn = parent.definedIn;
  return registerDefinition(definition);
}
