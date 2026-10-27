/**
 * The change indication of a view control: an accent dot, and the wording a
 * screen reader hears as the control's description. Both stay hidden until
 * the control is marked. The marked control names the wording through
 * `aria-describedby`, so the caller gives both the same `id`.
 */

/** The view axis of the control that carries the mark. */
export type ChangeMarkKind = "scheme" | "viewport";

export function ChangeMark({
  id,
  kind,
  marked,
  text,
}: {
  /** The id of the wording, unique in the document. */
  id: string;
  kind: ChangeMarkKind;
  marked: boolean;
  /** What a screen reader announces, such as `Other theme changed`. */
  text: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="mbk-view-changed"
        data-view-changed={kind}
        hidden={!marked}
      />
      <span
        className="mbk-view-changed-text"
        data-view-changed-text={kind}
        hidden={!marked}
        id={id}
      >
        {text}
      </span>
    </>
  );
}
