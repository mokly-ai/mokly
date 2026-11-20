import { Action } from "../components/action";

/**
 * The inline confirmation a dirty pane shows instead of closing. It renders in
 * the pane, never as a second dialog, and Cancel keeps both the draft and the
 * surface exactly where they were.
 */
export function DiscardConfirmation({
  onDiscard,
  onCancel,
}: {
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="fo-note fo-note-danger" role="alert">
      <span className="fo-note-title">Discard your changes?</span>
      <span className="fo-note-detail">
        Your unsaved changes in settings are lost.
      </span>
      <div className="review-inline">
        <Action
          label="Discard changes"
          tone="danger"
          size="md"
          onPress={onDiscard}
          testID="discard-changes"
        />
        <Action
          label="Cancel"
          tone="quiet"
          size="md"
          onPress={onCancel}
          testID="keep-changes"
        />
      </div>
    </section>
  );
}
