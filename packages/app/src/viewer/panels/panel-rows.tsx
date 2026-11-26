import { createListStyles, List, ListItem } from "@firna/ui/list";
import { useSharedUiTheme } from "@firna/ui/theme";

import { Action } from "../../components/action";
import { RowLink, StateDot } from "../../components/controls";
import type { RowPress, StatusTone } from "../../components/controls";
import { WaitingDot } from "../../components/placeholder-rows";
import { ControlPlaceholder, TextBar } from "../../components/placeholders";
import { useCompact } from "../../layout/viewport";

/**
 * How a row's title reads: a branch is a reference and reads in mono, a pull
 * request keeps its number and title in sans, and anything else is plain.
 */
type TitleForm = "plain" | "reference" | "pullRequest";

/**
 * One row of a panel's list: the switcher's references, History's
 * publications and builds, Share's screens and the projects panel's projects.
 * A row that goes somewhere is the link as a whole. The row the reader is on
 * takes the signal-soft fill, and its `mark` says so at the row's end.
 */
export type PanelRow = {
  id: string;
  title: string;
  form?: TitleForm;
  detail?: string;
  status?: StatusTone;
  /** The short SHA, in mono before the row's end. */
  sha?: string;
  /** Whether this is the row the reader is on. */
  current?: boolean;
  /** What the row's end says for the row the reader is on, such as Current. */
  mark?: string;
} & RowPress;

/**
 * One row while the list's read runs, in the loaded row's own frame: an empty
 * title or detail is the answer's, so it draws as a bar, a detail that is
 * absent draws no line, and the row's end draws its choice as a placeholder.
 * A row that goes somewhere is no link yet, because its target needs the
 * answer.
 */
export interface WaitingPanelRow {
  id: string;
  waiting: true;
  title: string;
  detail?: string;
  /** Whether the loaded row leads with a status dot. */
  status?: boolean;
  /** Whether the loaded row carries a short SHA. */
  sha?: boolean;
  /** Whether the row ends in a control that chooses. */
  choose?: boolean;
}

/** The size of a row's density in the package's list scale. */
type Size = "sm" | "md";

/** The row's title in its form. */
function Title({ title, form = "plain" }: Pick<PanelRow, "title" | "form">) {
  if (form === "pullRequest") {
    // A pull request's title starts with its number, which never holds a
    // space, so the first word is the number.
    const [number, ...words] = title.split(" ");
    return (
      <span className="fo-canvas-row-title">
        <span className="fo-canvas-row-number">{number}</span> {words.join(" ")}
      </span>
    );
  }
  const reference = form === "reference";
  return (
    <span
      className={
        reference
          ? "fo-canvas-row-title fo-canvas-row-reference"
          : "fo-canvas-row-title"
      }
    >
      {title}
    </span>
  );
}

/**
 * The row's end: the mark of the row the reader is on, its choice, or an
 * empty column that keeps the SHAs in line.
 */
function End({ row }: { row: PanelRow }) {
  if (row.mark !== undefined)
    return (
      <span className="fo-canvas-row-end fo-canvas-row-mark">{row.mark}</span>
    );
  if (row.onChoose)
    return (
      <span className="fo-canvas-row-end fo-canvas-row-choice">
        <Action
          label={row.action}
          tone="quiet"
          size="sm"
          onPress={row.onChoose}
          testID={"choose-" + row.id}
        />
      </span>
    );
  return <span className="fo-canvas-row-end" />;
}

/**
 * One loaded row: the package's list row, the link as a whole when the row
 * goes somewhere, with the row's end beside it.
 */
function Row({ row, size }: { row: PanelRow; size: Size }) {
  return (
    <div
      className={
        row.current
          ? "content-list-row fo-canvas-row-current"
          : "content-list-row"
      }
    >
      <RowLink row={row}>
        <ListItem
          size={size}
          title={<Title title={row.title} form={row.form} />}
          description={row.detail}
          leading={row.status ? <StateDot tone={row.status} /> : undefined}
          trailing={
            row.sha === undefined ? undefined : (
              <span className="row-meta mono-value">{row.sha}</span>
            )
          }
        />
      </RowLink>
      <End row={row} />
    </div>
  );
}

/**
 * The detail line of a waiting row: a bar in the line box that the package
 * gives a row's description at this density.
 */
function WaitingDetail({ size }: { size: Size }) {
  const line = createListStyles(useSharedUiTheme(), size).itemDescription;
  return (
    <span
      style={{ fontSize: line.fontSize, lineHeight: line.lineHeight + "px" }}
    >
      <TextBar width="13em" />
    </span>
  );
}

/**
 * One row while the list's read runs, in the loaded row's own frame: the
 * same title, detail, dot and SHA places, each a bar where the answer
 * supplies it, and the row's end in its waiting form.
 */
function WaitingRow({ row, size }: { row: WaitingPanelRow; size: Size }) {
  return (
    <div className="content-list-row">
      <ListItem
        size={size}
        title={
          row.title ? (
            <Title title={row.title} />
          ) : (
            <span className="fo-canvas-row-title">
              <TextBar width="9em" />
            </span>
          )
        }
        description={
          row.detail === undefined
            ? undefined
            : row.detail || <WaitingDetail size={size} />
        }
        leading={row.status ? <WaitingDot /> : undefined}
        trailing={
          row.sha ? (
            <span className="row-meta mono-value">
              <TextBar width="5em" />
            </span>
          ) : undefined
        }
      />
      {row.choose ? (
        <span className="fo-canvas-row-end fo-canvas-row-choice">
          <ControlPlaceholder size="sm" width={64} />
        </span>
      ) : (
        <span className="fo-canvas-row-end" />
      )}
    </div>
  );
}

/**
 * A panel's list in Canvas, as the catalogue's `PanelList` draws it: the
 * package's list and rows at the surface's density, with no hairlines between
 * the rows. The shared content list draws a row's title only in the package's
 * sans and has no row the reader is on, so the panels draw this one.
 */
export function PanelList({
  label,
  rows,
}: {
  label: string;
  rows: readonly (PanelRow | WaitingPanelRow)[];
}) {
  const size = useCompact() ? "md" : "sm";
  return (
    <div className="fo-canvas-rows">
      <List
        accessibilityLabel={label}
        items={[...rows]}
        itemKey={(row) => row.id}
        size={size}
        separators={false}
        renderItem={(row) =>
          "waiting" in row ? (
            <WaitingRow row={row} size={size} />
          ) : (
            <Row row={row} size={size} />
          )
        }
      />
    </div>
  );
}
