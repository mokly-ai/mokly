import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { NavNode } from "../../parts/nav.js";

import type { ComponentDesignDestination } from "./destinations.js";
import { COMPONENTS } from "./metadata.js";

/** Link button's two variants, which this branch moved to other components. */
export const MOVED_VARIANTS = [
  {
    parent: "action",
    path: "example/components/action/quiet",
    title: "Quiet",
  },
  {
    parent: "toolbar",
    path: "example/components/toolbar/inline",
    title: "Inline",
  },
] as const;

/** Each moved variant at its new place, as the removed parent's stage names it. */
export const MOVED_VARIANT_LABELS = MOVED_VARIANTS.map(
  ({ parent, title }) => `${COMPONENTS[parent].title} › ${title}`,
);

/**
 * Changes on the branch that removed the top-level Link button after its two
 * variants moved. Each variant keeps one Moved row under its new parent, and
 * the removed parent is one flat row after the current tree. The parents are
 * unmodified containers, and no artboard depicts the moved variants, so those
 * rows stay depictions.
 */
export function movedVariantNodes(
  design: ComponentDesignDestination,
): NavNode[] {
  return [
    { key: "example", depth: 0, kind: "folder", label: "Example", open: true },
    {
      key: "components",
      depth: 1,
      kind: "folder",
      label: "Components",
      open: true,
    },
    ...MOVED_VARIANTS.flatMap(({ parent, path, title }): NavNode[] => [
      {
        key: COMPONENT_NAVIGATION[parent].id,
        depth: 2,
        kind: "component",
        label: COMPONENT_NAVIGATION[parent].title,
        variants: "open",
      },
      {
        key: path,
        depth: 3,
        kind: "variant",
        label: title,
        moved: true,
        variantParentKind: "component",
      },
    ]),
    {
      key: COMPONENT_NAVIGATION["link-button"].id,
      depth: 0,
      kind: "component",
      label: `${COMPONENT_NAVIGATION["link-button"].title} · Removed`,
      to: design,
    },
  ];
}
