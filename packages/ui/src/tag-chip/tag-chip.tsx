/**
 * A tag as a toggle chip, pressed while the tag filters the catalogue. The
 * tag picker and an entry's details draw the same chip.
 */

import { TagIcon } from "../icons/icons.js";

export function TagChip({
  onSelect,
  selected,
  tabIndex,
  tag,
}: {
  /**
   * Receives the tag and the chip when the reader presses it, for a host that
   * moves focus from the chip.
   */
  onSelect?: ((tag: string, chip: HTMLButtonElement) => void) | undefined;
  /** Whether the tag filters the catalogue, which presses the chip. */
  selected: boolean;
  /** The chip's tab index, for a group that moves focus between its chips. */
  tabIndex?: number | undefined;
  /** The tag, which the chip shows and carries in `data-mokly-tag`. */
  tag: string;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`mbk-chip tag${selected ? " active" : ""} mbk-reset`}
      data-mokly-tag={tag}
      onClick={(event) => onSelect?.(tag, event.currentTarget)}
      tabIndex={tabIndex}
      type="button"
    >
      <TagIcon size={11} />
      {tag}
    </button>
  );
}
