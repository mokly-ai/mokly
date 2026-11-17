import { Avatar } from "@firna/ui/avatar";
import { Badge } from "@firna/ui/badge";
import { List, ListItem } from "@firna/ui/list";
import { SegmentedControl } from "@firna/ui/segmented";
import { StatusDot } from "@firna/ui/status-dot";
import { Table, TableCell } from "@firna/ui/table";
import type { ReactNode } from "react";

import { useCompact } from "../layout/viewport";
import { Action } from "./action";
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

/** One row of a shared content list. */
export interface ContentRow {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  mono?: boolean;
  status?: StatusTone;
  href?: string;
  action?: string;
  /** Takes the destination's place, for a row whose owner drives the move. */
  onFollow?: () => void;
  /**
   * A row whose action changes what the panel is showing rather than going
   * anywhere, so it is a control rather than a destination and is not
   * openable in a second tab.
   */
  onChoose?: () => void;
}

/**
 * One row of a list whose read runs: the row's own frame, with a bar in place
 * of each text that the answer supplies, as the catalogue's registered list
 * draws a row that waits.
 */
export type WaitingContentRow = WaitingRow & { id: string; waiting: true };

/** The shared rows a panel lists, with an optional destination at the right. */
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
            {row.onChoose && row.action ? (
              <Action
                label={row.action}
                tone="quiet"
                size="sm"
                onPress={row.onChoose}
                testID={"choose-" + row.id}
              />
            ) : (
              row.href &&
              row.action && (
                <AppLink
                  href={row.href}
                  onPress={row.onFollow}
                  className="list-destination"
                >
                  <span>{row.action}</span>
                </AppLink>
              )
            )}
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
