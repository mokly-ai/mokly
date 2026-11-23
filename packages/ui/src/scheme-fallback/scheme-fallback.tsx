/**
 * The Light-only fallback of a preview: a view that keeps its light render
 * while the shell is Dark. The note is always rendered for such a preview,
 * and the stylesheet shows it only while the shell is Dark, so a change of
 * appearance needs no render.
 */

/**
 * The note that names the fallback. As the suffix of a label, such as a
 * frame label, it starts with a dash.
 */
export function LightOnlyNote({ suffix = false }: { suffix?: boolean }) {
  return (
    <span className="mbk-frame-scheme-note mbk-reset">
      {suffix ? " — Light only" : "Light only"}
    </span>
  );
}
