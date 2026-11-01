/**
 * A tag as a toggle chip, pressed while the tag filters the catalogue. The
 * tag picker and an entry's details draw the same chip. A static depiction
 * that runs no script draws it as a link to an address, or as a picture of
 * itself.
 */

import { TagIcon } from "../icons/icons.js";

export function TagChip({
  href,
  interactive = true,
  onSelect,
  selected,
  tabIndex,
  tag,
}: {
  /**
   * The address that the chip opens, such as another document that shows the
   * catalogue filtered by the tag. A chip with an address is a link, whose
   * fill shows whether the tag filters the catalogue.
   */
  href?: string | undefined;
  /**
   * Whether a chip without an address is a toggle button, as it is by
   * default. A static depiction that runs no script sets `false`, which draws
   * such a chip as a picture of itself.
   */
  interactive?: boolean;
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
  const className = `mbk-chip tag${selected ? " active" : ""} mbk-reset`;
  if (href !== undefined)
    return (
      <a
        className={className}
        data-mokly-tag={tag}
        href={href}
        tabIndex={tabIndex}
      >
        <TagIcon size={11} />
        {tag}
      </a>
    );
  if (!interactive)
    return (
      <span className={className} data-mokly-tag={tag}>
        <TagIcon size={11} />
        {tag}
      </span>
    );
  return (
    <button
      aria-pressed={selected}
      className={className}
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
