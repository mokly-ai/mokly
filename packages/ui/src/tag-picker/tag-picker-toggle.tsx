/**
 * The tag button at the end of the catalogue search. It is a control of the
 * shell, a link to an address that a static depiction gives, or a picture of
 * itself in a depiction that runs no script.
 */

import type { Ref } from "react";

import { TagIcon } from "../icons/icons.js";

/**
 * The button that opens and closes the picker. The button reports whether
 * the picker is expanded. A link or a picture has no expanded state, so its
 * name says whether it opens or closes the picker.
 */
export function TagPickerToggle({
  href,
  onToggle,
  open,
  operable,
  pickerId,
  ref,
}: {
  href: string | undefined;
  onToggle: () => void;
  open: boolean;
  operable: boolean;
  pickerId: string;
  ref: Ref<HTMLButtonElement>;
}) {
  const name = open ? "Close tag picker" : "Filter by tag";
  if (href !== undefined)
    return (
      <a
        aria-label={name}
        className="mbk-search-tag"
        data-mokly-tag-toggle=""
        href={href}
      >
        <TagIcon />
      </a>
    );
  if (!operable)
    return (
      <span
        aria-label={name}
        className="mbk-search-tag"
        data-mokly-tag-toggle=""
        role="img"
      >
        <TagIcon />
      </span>
    );
  return (
    <button
      aria-controls={pickerId}
      aria-expanded={open}
      aria-label="Filter by tag"
      className="mbk-search-tag"
      data-mokly-tag-toggle=""
      onClick={onToggle}
      ref={ref}
      type="button"
    >
      <TagIcon />
    </button>
  );
}
