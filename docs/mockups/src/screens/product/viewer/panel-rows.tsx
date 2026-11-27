import { createListStyles, List, ListItem } from "@firna/ui/list";
import { useSharedUiTheme } from "@firna/ui/theme";
import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { StatusDot } from "../../../entries/design/status-dot.mockup";
import { useMockupRenderContext } from "../../../render-context";
import { WaitingDot } from "../placeholder-rows";
import { TextBar } from "../placeholders";

/**
 * How a row's title reads: a branch is a reference and reads in mono, a pull
 * request keeps its number and title in sans, and anything else is plain.
 */
type TitleForm = "plain" | "reference" | "pullRequest";

/**
 * One row of a panel's list: the switcher's references, History's
 * publications and builds, Share's screens and the projects panel's
 * projects. A row that leads somewhere is the link as a whole, and a row
 * that chooses is the button as a whole. The row the reader is on takes the
 * signal-soft fill, and its `mark` says so at the row's end.
 */
export type PanelRow = LoadedPanelRow | WaitingPanelRow;

/** What a loaded row and a waiting row both show. */
interface PanelRowBase {
  id: string;
  title: string;
  form?: TitleForm;
  detail?: string;
  status?: "neutral" | "success" | "warning" | "danger";
  /** The short SHA, in mono before the row's end. */
  sha?: string;
}

/** A loaded row. */
interface LoadedPanelRow extends PanelRowBase {
  waiting?: false;
  /** Whether this is the row the reader is on. */
  current?: boolean;
  /** What the row's end says for the row the reader is on, such as Current. */
  mark?: string;
  /** Where the row leads: the whole row is the link, or the button of a choice. */
  to?: string;
  /** The destination is a choice inside the panel, so the row is a button. */
  choose?: boolean;
}

/**
 * The row while the list's read runs, in its own frame: an empty title,
 * detail or SHA is the answer's, so it draws as a bar. It leads nowhere and
 * chooses nothing yet, because its target needs the answer.
 */
interface WaitingPanelRow extends PanelRowBase {
  waiting: true;
  current?: never;
  mark?: never;
  to?: never;
  choose?: never;
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
  return (
    <span
      className={
        form === "reference"
          ? "fo-canvas-row-title fo-canvas-row-reference"
          : "fo-canvas-row-title"
      }
    >
      {title}
    </span>
  );
}

/**
 * The row's end: the mark of the row the reader is on, or an empty column that
 * keeps the SHAs in line.
 */
function End({ row }: { row: LoadedPanelRow }) {
  return row.mark === undefined ? (
    <span className="fo-canvas-row-end" />
  ) : (
    <span className="fo-canvas-row-end fo-canvas-row-mark">{row.mark}</span>
  );
}

/**
 * A row's content, as the link of a row that leads somewhere or the button of
 * a row that chooses. A drawing's choice leads to the state that it chooses,
 * so it draws as a link where the app draws a button, with the same states.
 */
function RowContent({
  row,
  children,
}: {
  row: LoadedPanelRow;
  children: ReactNode;
}) {
  if (row.to === undefined) return children;
  if (row.choose)
    return (
      <MockLink className="row-choice" to={row.to}>
        {children}
      </MockLink>
    );
  return (
    <MockLink className="row-link" to={row.to}>
      {children}
    </MockLink>
  );
}

/**
 * One loaded row: the package's list row, the link as a whole when the row
 * leads somewhere or the button as a whole when it chooses, with the row's
 * end beside it.
 */
function Row({ row, size }: { row: LoadedPanelRow; size: Size }) {
  const item = (
    <ListItem
      size={size}
      title={<Title title={row.title} form={row.form} />}
      description={row.detail}
      leading={
        row.status ? (
          <StatusDot moklyInstance={"row-" + row.id} tone={row.status} />
        ) : undefined
      }
      trailing={
        row.sha === undefined ? undefined : (
          <span className="row-meta mono-value">{row.sha}</span>
        )
      }
    />
  );
  return (
    <div
      className={
        row.current
          ? "content-list-row fo-canvas-row-current"
          : "content-list-row"
      }
    >
      <RowContent row={row}>{item}</RowContent>
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
 * supplies it, and the row's end empty.
 */
function WaitingRow({ row, size }: { row: WaitingPanelRow; size: Size }) {
  return (
    <div className="content-list-row">
      <ListItem
        size={size}
        title={
          row.title ? (
            <Title title={row.title} form={row.form} />
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
          row.sha === undefined ? undefined : (
            <span className="row-meta mono-value">
              <TextBar width="5em" />
            </span>
          )
        }
      />
      <span className="fo-canvas-row-end" />
    </div>
  );
}

/**
 * A panel's list in Canvas: the package's list and rows at the viewport's
 * density, with no hairlines between the rows. The registered content list
 * draws a row's title only in the package's sans and has no row the reader is
 * on, so the panels draw this one.
 */
export function PanelList({
  label,
  rows,
}: {
  label: string;
  rows: readonly PanelRow[];
}) {
  const { viewport } = useMockupRenderContext();
  const size = viewport === "mobile" ? "md" : "sm";
  return (
    <div className="fo-canvas-rows">
      <List
        accessibilityLabel={label}
        items={[...rows]}
        itemKey={(row) => row.id}
        size={size}
        separators={false}
        renderItem={(row) =>
          row.waiting ? (
            <WaitingRow row={row} size={size} />
          ) : (
            <Row row={row} size={size} />
          )
        }
      />
    </div>
  );
}
