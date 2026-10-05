/**
 * The one secondary line an inspector tab shows while Live is selected, in
 * place of content that lists, reads or edits the rendered view.
 */
export function StaticNotice() {
  return (
    <p className="ce-muted">Switch to Static to inspect or edit this view.</p>
  );
}
