/**
 * The catalogue column of the depicted Mokly viewer in the home's Browse
 * frame: the Specs and Components sections of the acme/storefront
 * catalogue, with the open checkout/payment screen and a dot on each changed
 * or added entry, which the Changes filter counts. `ViewerTree.astro` draws
 * them.
 */
import type { IconName } from "../icons.js";

/** One row of the depicted tree. */
export interface TreeRow {
  /** The dot of an entry that the branch changed or added. */
  readonly change?: "added" | "changed";
  /** The open screen, which the tree selects. */
  readonly current?: boolean;
  /** 0 for a folder or a root entry, 1 inside a folder, 2 for a variant. */
  readonly depth: 0 | 1 | 2;
  readonly icon?: IconName;
  readonly label: string;
  /** A folder, or a component with its variants, drawn open. */
  readonly open?: boolean;
}

/** One section of the tree, under its head. */
export interface TreeSection {
  readonly rows: readonly TreeRow[];
  readonly title: string;
}

/** The sections of the tree, in the viewer's order. */
export const TREE_SECTIONS: readonly TreeSection[] = [
  {
    rows: [
      { depth: 0, label: "checkout", open: true },
      {
        change: "changed",
        current: true,
        depth: 1,
        icon: "screen",
        label: "payment",
      },
      { change: "added", depth: 1, icon: "screen", label: "review-order" },
      { depth: 0, label: "onboarding", open: true },
      { depth: 1, icon: "screen", label: "welcome" },
      { depth: 0, label: "account", open: true },
      { change: "changed", depth: 1, icon: "screen", label: "settings" },
      { change: "changed", depth: 0, icon: "screen", label: "pricing" },
    ],
    title: "Specs",
  },
  {
    rows: [
      { depth: 0, icon: "component", label: "Button", open: true },
      { depth: 2, label: "Primary" },
      { depth: 2, label: "Secondary" },
      { depth: 2, label: "Danger" },
      { depth: 0, icon: "component", label: "PriceCard" },
      { depth: 0, icon: "component", label: "Avatar" },
    ],
    title: "Components",
  },
];

/** The count of the Changes filter: every entry with a dot. */
export const CHANGE_COUNT = TREE_SECTIONS.flatMap(
  (section) => section.rows,
).filter((row) => row.change !== undefined).length;
