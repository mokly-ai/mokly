import { Avatar } from "@firna/ui/avatar";
import { Badge } from "@firna/ui/badge";
import { List, ListItem } from "@firna/ui/list";
import { SegmentedControl } from "@firna/ui/segmented";
import { StatusDot } from "@firna/ui/status-dot";
import { Table, TableCell } from "@firna/ui/table";
import type { ReactNode } from "react";

import { useCompact } from "../layout/viewport";

import { AppLink } from "./app-link";
import { WaitingListRow } from "./placeholder-rows";
import type { WaitingRow } from "./placeholder-rows";

const statusTones = {
  neutral: "neutral",
  success: "primary",
  warning: "warning",
  danger: "danger",
} as const;

/** The semantic states a row or dot may report. */
export type StatusTone = keyof typeof statusTones;

/**
 * A decorative dot beside a phrase that already states the status in words,
 * for chrome too tight for a badge.
 */
export function StateDot({ tone }: { tone: StatusTone }) {
  return <StatusDot tone={statusTones[tone]} size="sm" />;
}

/** A soft status badge whose text states the status in words. */
export function StatusBadge({
  label,
  tone = "neutral",
  dot,
}: {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
}) {
  return (
    <Badge tone={statusTones[tone]} variant="soft" dot={dot}>
      {label}
    </Badge>
  );
}

/** A decorative initials avatar beside a name that already identifies it. */
export function PersonAvatar({
  name,
  size = 28,
}: {
  name: string;
  size?: number;
}) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <Avatar
      label={initials || "?"}
      tone="soft"
      shape="circle"
      size={size}
      decorative
    />
  );
}

/**
 * What a press on a row does. A row that goes to one place is the link as a
 * whole, and a row whose only action is to choose it, rather than go
 * anywhere, is a button as a whole. Neither carries a label of its own: its
 * title already names what it opens or chooses. A choice changes what its
 * panel shows, so it is not openable in a second tab. A row with neither
 * leads nowhere.
 */
export type RowPress =
  RowDestination | { onChoose: () => void; href?: never; onFollow?: never };

/** Where a row that goes somewhere leads, or nothing for a row that does not. */
export interface RowDestination {
  href?: string;
  /** Takes the destination's place, for a row whose owner drives the move. */
  onFollow?: () => void;
  onChoose?: never;
}

/**
 * One row of a shared content list. A record list holds no choice, so its
 * row goes somewhere or nowhere.
 */
export type ContentRow = {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  mono?: boolean;
  status?: StatusTone;
} & RowDestination;

/**
 * One row of a list whose read runs: the row's own frame, with a bar in place
 * of each text that the answer supplies, as the catalogue's registered list
 * draws a row that waits.
 */
export type WaitingContentRow = WaitingRow & { id: string; waiting: true };

/**
 * A row's content, as the link of a row that goes somewhere or the button of
 * a row that chooses: the whole row takes the click, and the link or the
 * button reaches the row's full frame.
 */
export function RowContent({
  row,
  children,
}: {
  row: RowPress;
  children: ReactNode;
}) {
  // The native button keeps its own keyboard and focus behaviour. It holds
  // the package row's block markup, which HTML allows only in phrasing
  // content, and every browser draws and presses it as one box.
  if (row.onChoose)
    return (
      <button type="button" className="row-choice" onClick={row.onChoose}>
        {children}
      </button>
    );
  if (row.href === undefined) return children;
  return (
    <AppLink href={row.href} onPress={row.onFollow} className="row-link">
      {children}
    </AppLink>
  );
}

/** The shared rows a panel lists; a row that goes somewhere is a link. */
export function ContentList({
  label,
  rows,
}: {
  label: string;
  rows: readonly (ContentRow | WaitingContentRow)[];
}) {
  const compact = useCompact();
  const size = compact ? "md" : "sm";
  return (
    <List
      accessibilityLabel={label}
      items={[...rows]}
      itemKey={(row) => row.id}
      size={size}
      renderItem={(row) =>
        "waiting" in row ? (
          <WaitingListRow row={row} size={size} />
        ) : (
          <div className="content-list-row">
            <RowContent row={row}>
              <ListItem
                size={size}
                title={row.title}
                description={row.detail}
                leading={
                  row.status ? (
                    <StatusDot tone={statusTones[row.status]} size="sm" />
                  ) : undefined
                }
                trailing={
                  row.meta ? (
                    <span
                      className={
                        "row-meta" + (row.mono ? " mono-value" : " numeric")
                      }
                    >
                      {row.meta}
                    </span>
                  ) : undefined
                }
              />
            </RowContent>
          </div>
        )
      }
    />
  );
}

/** A choice between named roles or modes. */
export function Choice({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const compact = useCompact();
  return (
    <SegmentedControl
      accessibilityLabel={label}
      options={[...options]}
      value={value}
      disabled={disabled}
      onChange={onChange}
      size={compact ? "lg" : "md"}
      wrap
    />
  );
}

/** A two-column record table for the workspace's projects overview. */
export function RecordTable({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: readonly { key: string; label: string; flex?: number }[];
  rows: readonly { id: string; cells: Record<string, ReactNode> }[];
}) {
  return (
    <Table
      accessibilityLabel={label}
      size="md"
      columns={columns.map((column) => ({
        key: column.key,
        label: column.label,
        flex: column.flex,
      }))}
      rows={[...rows]}
      rowKey={(row) => row.id}
      cell={(row, key) => <TableCell size="md">{row.cells[key]}</TableCell>}
    />
  );
}
