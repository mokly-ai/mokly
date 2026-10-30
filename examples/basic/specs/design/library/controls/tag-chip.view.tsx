import { mockLink } from "@mokly/mokly";

import { TagChip } from "../../../../../../packages/ui/src/tag-chip/tag-chip.js";

import type { TagChipProps } from "./tag-chip.js";

/**
 * The shipped tag chip. A static artboard runs no script, so a chip with a
 * destination links to the artboard that shows its filter, and a chip
 * without one is a picture of itself.
 */
export function TagChipView({ label, selected, destination }: TagChipProps) {
  return (
    <TagChip
      href={destination === undefined ? undefined : mockLink(destination)}
      interactive={false}
      selected={selected}
      tag={label}
    />
  );
}
