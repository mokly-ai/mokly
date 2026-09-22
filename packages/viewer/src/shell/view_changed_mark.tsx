/** The visual and accessible change indication shared by preview controls. */

import {
  VIEW_CHANGED_CLASS,
  VIEW_CHANGED_TEXT,
  VIEW_CHANGED_TEXT_CLASS,
} from "./view_marks.js";

export function ViewChangedMark({
  id,
  kind,
  marked,
}: {
  id: string;
  kind: "scheme" | "viewport";
  marked: boolean;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={VIEW_CHANGED_CLASS}
        data-view-changed={kind}
        hidden={!marked}
      />
      <span
        className={VIEW_CHANGED_TEXT_CLASS}
        data-view-changed-text={kind}
        hidden={!marked}
        id={id}
      >
        {VIEW_CHANGED_TEXT[kind]}
      </span>
    </>
  );
}
