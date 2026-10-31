/**
 * The Light-only fallback of a preview: a document or a view that keeps its
 * light render while the shell is Dark. The note and the band are always
 * rendered for such a preview, and the stylesheet shows them only while the
 * shell is Dark, so a change of appearance needs no render.
 */

/**
 * The note that names the fallback. As the suffix of a label, such as a
 * frame label or "Showing previous version", it starts with a dash.
 */
export function LightOnlyNote({ suffix = false }: { suffix?: boolean }) {
  return (
    <span className="mbk-frame-scheme-note">
      {suffix ? " — Light only" : "Light only"}
    </span>
  );
}

/**
 * The quiet band above a current document with no dark render, which a whole
 * document needs because it has no frame label. It takes the look of the
 * previous-version band.
 */
export function LightOnlyBand() {
  return (
    <p
      className="mbk-previous mbk-scheme-fallback"
      data-color-scheme-fallback=""
    >
      <LightOnlyNote />
    </p>
  );
}
