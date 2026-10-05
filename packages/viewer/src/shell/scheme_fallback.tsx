/** The Light-only fallback note for whole documents, which have no frame label. */

/**
 * Whether a document keeps its light page under Dark: it has no dark render
 * while the catalogue has a dark axis. A wholly light-only catalogue names no
 * fallback, because no dark axis exists.
 */
export function documentLightOnly(
  entry: { kind: string; colorSchemes?: readonly string[] },
  hasDarkFragments: boolean,
): boolean {
  return (
    entry.kind === "document" &&
    hasDarkFragments &&
    !(entry.colorSchemes ?? []).includes("dark")
  );
}

/**
 * The quiet band above a current document with no dark render. It is always
 * rendered for such a document, and the stylesheet shows it only while the
 * shell is Dark, so the server render and hydration agree.
 */
export function LightOnlyBand() {
  return (
    <p
      className="mbk-previous mbk-scheme-fallback"
      data-color-scheme-fallback=""
    >
      <span className="mbk-frame-scheme-note">Light only</span>
    </p>
  );
}
