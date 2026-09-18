// The catalogue's tags as controls. One chip is rendered on two surfaces —
// the details inspector's metadata row for the selected entry, and the picker
// the search field drops for every tag the catalogue declares — so both read
// and behave the same: the Browse client turns a chip into the matching
// `tag:` search term and marks the chip that the entered query names.

import { TagIcon } from "./icons.js";

/**
 * One tag as a control. The chip is pressed while the entered query names its
 * tag, which the Browse client keeps in step with the search field.
 */
export function TagChip(props: { tag: string }) {
  return (
    <button
      aria-pressed="false"
      className="mbk-chip tag"
      data-mokly-tag={props.tag}
      type="button"
    >
      <TagIcon size={11} />
      {props.tag}
    </button>
  );
}

/**
 * The tag control at the trailing edge of the search field and the closed
 * panel it drops under it, listing every tag the catalogue declares. The
 * panel's chip row is a toolbar because the Browse client roves one tab stop
 * across it; the details inspector's chips stay independent tab stops. A
 * catalogue that declares no tags renders neither.
 */
export function SearchTagPicker(props: { tags: readonly string[] }) {
  if (props.tags.length === 0) {
    return null;
  }
  return (
    <>
      <button
        aria-controls="mb-tag-picker"
        aria-expanded="false"
        aria-label="Filter by tag"
        className="mbk-search-tag"
        data-mokly-tag-toggle=""
        type="button"
      >
        <TagIcon />
      </button>
      <div
        aria-label="Tags"
        className="mbk-tag-picker"
        hidden
        id="mb-tag-picker"
        role="group"
      >
        <div className="mbk-tag-picker-head">Tags</div>
        <span aria-label="Tag filters" className="mbk-chips" role="toolbar">
          {props.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </span>
      </div>
    </>
  );
}
