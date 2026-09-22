// The changed mark a catalogue row carries. The stylesheet draws it from
// `data-changed` and `data-changed-variants`, so the server render and every
// client update agree on it without a second state channel: the row markup
// always holds the wording, and CSS decides whether it reaches the
// accessibility tree beside the dot.

/** Class the stylesheet reveals only to assistive technology. */
export const NAV_CHANGED_TEXT_CLASS = "mbk-nav-changed-text";

/** Attribute that identifies the wording, so search never matches it. */
export const NAV_CHANGED_TEXT_ATTRIBUTE = "data-nav-changed-text";

/** What a screen reader announces after a marked row's label. */
export const NAV_CHANGED_TEXT = "Changed";
