import type { ManifestComponentVariant } from "@mokly/viewer";
import type {
  GeneratedComponentView,
  ReviewVariantAddress,
} from "@mokly/viewer/data";

export function variantAddress(
  variant: ManifestComponentVariant,
): ReviewVariantAddress {
  return {
    id: variant.id,
    title: variant.title,
    ...(variant.description ? { description: variant.description } : {}),
    props: variant.props,
    suppliedSlots: variant.suppliedSlots,
  };
}
export function viewPairs(
  before: readonly GeneratedComponentView[],
  after: readonly GeneratedComponentView[],
) {
  const key = (view: GeneratedComponentView) =>
    `${view.variantId ?? ""}:${view.viewport === "mobile" ? 0 : 1}:${view.colorScheme === "light" ? 0 : 1}`;
  const bases = new Map(before.map((view) => [key(view), view]));
  const heads = new Map(after.map((view) => [key(view), view]));
  return [...new Set([...bases.keys(), ...heads.keys()])]
    .sort()
    .map((key) => ({ before: bases.get(key), after: heads.get(key) }));
}
