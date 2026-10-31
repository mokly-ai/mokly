import { mockLink } from "@mokly/mokly";

import { VariantBar as VariantBarView } from "../../../../../../packages/ui/src/variant-bar/variant-bar.js";

/** One entry of a component page's variant bar. */
export interface VariantBarOption {
  label: string;
  /** The entry's path, which the shipped bar carries for each option. */
  path: string;
  /** Whether the entry is a variant that the branch removed. */
  removed?: boolean;
  /** The artboard that shows this entry; an option without one is not linked. */
  to?: string;
  current?: boolean;
}

/**
 * The shipped variant bar: the parent's own entry first, then each saved
 * variant in authored order, with the shown entry marked. The shown entry
 * links to its own artboard, and an option without an artboard is a picture
 * of its link.
 */
export function VariantBar({
  options,
}: {
  options: readonly VariantBarOption[];
}) {
  return (
    <VariantBarView
      variants={options.map((option) => ({
        current: option.current ?? false,
        href: option.to === undefined ? undefined : mockLink(option.to),
        path: option.path,
        removed: option.removed ?? false,
        title: option.label,
      }))}
    />
  );
}
