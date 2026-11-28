import { createListStyles, ListItem } from "@firna/ui/list";
import { SkeletonCircle } from "@firna/ui/skeleton";
import { createStatusDotStyles } from "@firna/ui/status-dot";
import { useSharedUiTheme } from "@firna/ui/theme";
import type { ReactNode } from "react";

import { TextBar } from "./placeholders";

/**
 * The placeholder forms of the local list rows: each draws the row's own frame
 * from the classes the loaded row uses, with a bar in place of each text that
 * the answer supplies. A list draws one of them while its read runs, also a
 * list that can be empty. The registered content list and table draw their
 * waiting rows from a row's `waiting` flag; the content list's is below.
 */

/**
 * A person in the members list: the avatar at its own size, the name over the
 * address, and the role. `control` is the row's control in its own placeholder
 * form: a control whose label is known draws itself, disabled.
 */
export function MemberRowPlaceholder({
  avatar,
  control,
}: {
  /** The avatar's diameter in px, as the loaded row draws it. */
  avatar: number;
  control?: ReactNode;
}) {
  return (
    <div className="fo-member-row">
      <span className="fo-wait-avatar" aria-hidden="true">
        <SkeletonCircle diameter={avatar} />
      </span>
      <div className="fo-person-copy fo-wait-lines">
        <TextBar className="fo-person-name" width="7em" />
        <TextBar className="fo-person-detail" width="12em" />
      </div>
      <span className="review-inline">
        <span className="fo-role" aria-hidden="true">
          <TextBar width="3.5em" />
        </span>
        {control}
      </span>
    </div>
  );
}

/**
 * A note row, such as a token, an invitation or a GitHub account: the title
 * with what the head shows beside it, one bar for each line beneath it, and
 * the row's control at the end of the row or under its lines.
 */
export function NoteRowPlaceholder({
  lines = ["fo-note-detail"],
  head,
  end,
  below,
}: {
  /** The class of each line under the title, such as `fo-note-detail`. */
  lines?: readonly string[];
  /** Known text beside the title, such as a badge whose label is known. */
  head?: ReactNode;
  /** The row's control at the end of the row, in its placeholder form. */
  end?: ReactNode;
  /** The row's control under its lines, in its placeholder form. */
  below?: ReactNode;
}) {
  const facts = (
    <div className="fo-note-facts fo-wait-lines">
      <div className="fo-note-head">
        <TextBar className="fo-note-title" width="10em" />
        {head}
      </div>
      {lines.map((line, index) => (
        <TextBar key={line + index} className={line} width="14em" />
      ))}
      {below && <div>{below}</div>}
    </div>
  );
  return (
    <div className="fo-note">
      {end ? (
        <div className="fo-note-actions">
          {facts}
          {end}
        </div>
      ) : (
        facts
      )}
    </div>
  );
}

/**
 * A line of a waiting list row: a bar in the line box that the package gives
 * that line of a row at this density, read from the package's own list scale.
 */
function WaitingLine({
  part,
  size,
  width,
}: {
  part: "itemTitle" | "itemDescription";
  size: "sm" | "md";
  width: string;
}) {
  const line = createListStyles(useSharedUiTheme(), size)[part];
  return (
    <span
      style={{ fontSize: line.fontSize, lineHeight: line.lineHeight + "px" }}
    >
      <TextBar width={width} />
    </span>
  );
}

/**
 * A status dot whose tone the answer supplies, at the dot's own size: a
 * waiting list row's, and the viewer bar's beside its publication.
 */
export function WaitingDot() {
  const { dot } = createStatusDotStyles(useSharedUiTheme(), "sm");
  return <SkeletonCircle diameter={dot.width} />;
}

/**
 * A content-list row while the list's read runs: the package's own row, with
 * a bar in place of each text that the answer supplies. An empty title or
 * detail is the answer's, so it draws as a bar; one the caller already knows,
 * such as a settings pane's own name in the settings index, stays text. A row
 * that leads somewhere or chooses is no link and no button yet, because its
 * target needs the answer.
 */
export function WaitingListRow({
  row,
  size,
}: {
  row: {
    title: string;
    detail?: string;
    status?: string;
    meta?: string;
    mono?: boolean;
  };
  size: "sm" | "md";
}) {
  return (
    <div className="content-list-row">
      <ListItem
        size={size}
        title={
          row.title || <WaitingLine part="itemTitle" size={size} width="9em" />
        }
        description={
          row.detail === undefined
            ? undefined
            : row.detail || (
                <WaitingLine part="itemDescription" size={size} width="13em" />
              )
        }
        leading={row.status ? <WaitingDot /> : undefined}
        trailing={
          row.meta === undefined ? undefined : (
            <span className={"row-meta" + (row.mono ? " mono-value" : "")}>
              <TextBar width="5em" />
            </span>
          )
        }
      />
    </div>
  );
}
