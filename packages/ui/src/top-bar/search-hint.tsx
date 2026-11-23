/**
 * The key hint of the catalogue search field: a small key cap that names the
 * shortcut that moves focus to the field. It is a picture of the keys, so
 * assistive technology skips it, and the field of an interactive bar names
 * its shortcuts itself. The `⌘` is drawn as a glyph, because not every font
 * draws the character.
 */

/**
 * The shortcut that the hint names: `command` names `⌘K`, the key of a Mac,
 * and `control` names `Ctrl K`, the key of the other platforms.
 */
export type SearchShortcut = "command" | "control";

/** The `⌘` key, on a 16-unit grid, in the current colour. */
function CommandGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="mbk-reset"
      fill="none"
      height={10}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 16 16"
      width={10}
    >
      <path d="M6 6h4v4H6zM6 6V4.5A1.5 1.5 0 1 0 4.5 6H6M10 6V4.5a1.5 1.5 0 1 1 1.5 1.5H10M10 10v1.5a1.5 1.5 0 1 0 1.5-1.5H10M6 10v1.5a1.5 1.5 0 1 1-1.5-1.5H6" />
    </svg>
  );
}

/** The key cap of a shortcut: the drawn `⌘` and `K`, or `Ctrl K`. */
export function SearchHint({ shortcut }: { shortcut: SearchShortcut }) {
  return (
    <kbd aria-hidden="true" className="mbk-search-hint mbk-reset">
      {shortcut === "command" ? <CommandGlyph /> : "Ctrl "}K
    </kbd>
  );
}
