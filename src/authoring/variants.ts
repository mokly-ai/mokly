import { isPortableUrlPath } from "@mokly/viewer/data";

import type { ScreenDefinition, ScreenVariantInput } from "./types.js";

const VARIANT_AUTHORING = Symbol("mokly.screen-variant-authoring");
const FORBIDDEN_VARIANT_FIELDS = ["variants", "route", "childIds"] as const;

interface VariantAuthoringMetadata {
  forbiddenFields: readonly (typeof FORBIDDEN_VARIANT_FIELDS)[number][];
  slug: unknown;
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

/** Derive the routed document owned by one screen variant. */
export function screenVariantRoute(parentRoute: string, slug: string): string {
  const stem = parentRoute.endsWith(".html")
    ? parentRoute.slice(0, -".html".length)
    : parentRoute;
  return `${stem}.variants/${slug}.html`;
}

/** Check the complete parent-derived route shape stored in registry data. */
export function isScreenVariantRoute(
  parentRoute: string,
  route: string,
): boolean {
  if (!parentRoute.endsWith(".html") || !route.endsWith(".html")) return false;
  const prefix = `${parentRoute.slice(0, -".html".length)}.variants/`;
  if (!route.startsWith(prefix)) return false;
  const slug = route.slice(prefix.length, -".html".length);
  return isScreenVariantSlug(slug);
}

/** Check the single portable route segment accepted for a variant slug. */
export function isScreenVariantSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !value.includes("/") &&
    isPortableUrlPath(value)
  );
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
  const slug = typeof input.slug === "string" ? input.slug : "invalid";
  const address = variant.address ?? parent.address;
  const colorSchemes = variant.colorSchemes ?? parent.colorSchemes;
  const tags = variant.tags ?? parent.tags;
  const definition: AuthoredVariantDefinition = {
    __viaDefine: true,
    ...(address !== undefined ? { address } : {}),
    ...(colorSchemes !== undefined ? { colorSchemes } : {}),
    ...(Object.hasOwn(variant, "dependencies")
      ? { dependencies: (input as { dependencies?: unknown }).dependencies }
      : {}),
    description: variant.description,
    desktop: variant.desktop,
    id: variant.id,
    kind: "screen",
    mobile: variant.mobile,
    ...(variant.rationale !== undefined
      ? { rationale: variant.rationale }
      : {}),
    relatedDocs: variant.relatedDocs ?? parent.relatedDocs,
    route: screenVariantRoute(parent.route, slug),
    ...(tags !== undefined ? { tags } : {}),
    title: variant.title,
    useCaseIds: variant.useCaseIds ?? [],
    variantOf: parent.id,
    [VARIANT_AUTHORING]: {
      forbiddenFields: FORBIDDEN_VARIANT_FIELDS.filter(
        (field) => field in input,
      ),
      slug: input.slug,
    },
  };
  if (parent.definedIn !== undefined) definition.definedIn = parent.definedIn;
  return definition;
}
