/**
 * The `⌘K` hint at the end of the package's own search field, which the
 * drawing passes through the `tagPicker` prop of `TopBar`, the field's
 * documented end control. Milestone 11 builds the shortcut into the package;
 * until then the drawing passes the hint through the field's end control.
 *
 * The hint is a picture of the keys, so assistive technology skips it. The
 * `⌘` is drawn as a glyph, because not every font draws the character.
 */
export function SearchHint() {
  return (
    <kbd className="fo-canvas-kbd" aria-hidden="true">
      <svg
        className="fo-canvas-kbd-command"
        viewBox="0 0 16 16"
        width="10"
        height="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 6h4v4H6zM6 6V4.5A1.5 1.5 0 1 0 4.5 6H6M10 6V4.5a1.5 1.5 0 1 1 1.5 1.5H10M10 10v1.5a1.5 1.5 0 1 0 1.5-1.5H10M6 10v1.5a1.5 1.5 0 1 1-1.5-1.5H6" />
      </svg>
      K
    </kbd>
  );
}
