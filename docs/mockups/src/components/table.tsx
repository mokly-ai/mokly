import { Table, TableCell } from "@firna/ui/table";
import { Body } from "@firna/ui/typography";

import { TextBar } from "../screens/product/placeholders";
import { componentInput, componentMetadata } from "./metadata";

export const tableInput = componentInput({
  ...componentMetadata(
    "Table",
    "Aligned columns for publications, members and other scannable records.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "columns", "rows"],
    properties: {
      label: { type: "string" },
      size: { enum: ["md", "lg"] },
      columns: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "label"],
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            align: { enum: ["left", "right"] },
            flex: { type: "number" },
          },
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "cells"],
          properties: {
            id: { type: "string" },
            /**
             * The row while the table's read runs: its own frame with a bar in
             * place of each cell's text, not the package's loading rows, whose
             * heights differ from these rows.
             */
            waiting: { type: "boolean" },
            cells: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["key", "value"],
                properties: {
                  key: { type: "string" },
                  value: { type: "string" },
                  muted: { type: "boolean" },
                  mono: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
  },
  props: {
    label: "Publications",
    columns: [
      { key: "commit", label: "Commit", flex: 1 },
      { key: "published", label: "Published", flex: 1 },
      { key: "changes", label: "Changes", flex: 2 },
    ],
    rows: [
      {
        id: "current",
        cells: [
          { key: "commit", value: "72d6047", mono: true },
          { key: "published", value: "15 Sep", muted: true },
          { key: "changes", value: "3 screens changed, 1 added" },
        ],
      },
      {
        id: "earlier",
        cells: [
          { key: "commit", value: "df0e956", mono: true },
          { key: "published", value: "15 Sep", muted: true },
          { key: "changes", value: "Adopt Firna controls" },
        ],
      },
    ],
  },
  controls: {
    label: { kind: "text" },
    size: {
      kind: "select",
      options: [
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
  },
  render: ({ label, columns, rows, size = "md" }) => (
    <Table
      accessibilityLabel={label}
      size={size}
      columns={columns.map((column) => ({
        key: column.key,
        label: column.label,
        align: column.align,
        flex: column.flex,
      }))}
      rows={[...rows]}
      rowKey={(row) => row.id}
      testID="firna-table"
      cell={(row, key) => {
        const cell = row.cells.find((candidate) => candidate.key === key);
        if (!cell) return null;
        // A waiting cell keeps the cell's own type, so its bar keeps the line
        // box of the text it stands in for.
        const text = row.waiting ? <TextBar width="70%" /> : cell.value;
        if (size === "lg" && !cell.mono)
          return <Body color={cell.muted ? "muted" : "default"}>{text}</Body>;
        return (
          <TableCell muted={cell.muted} size={size}>
            {cell.mono ? <span className="mono-value">{text}</span> : text}
          </TableCell>
        );
      }}
    />
  ),
  variants: [
    {
      slug: "readable",
      title: "Readable rows",
      props: {
        label: "Project members",
        size: "lg",
        columns: [
          { key: "member", label: "Member", flex: 1 },
          { key: "role", label: "Role", flex: 1 },
        ],
        rows: [
          {
            id: "sam",
            cells: [
              { key: "member", value: "Sam" },
              { key: "role", value: "Reviewer" },
            ],
          },
        ],
      },
    },
    {
      slug: "publications",
      title: "Publications",
      props: {
        label: "Publications",
        columns: [
          { key: "commit", label: "Commit", flex: 1 },
          { key: "published", label: "Published", flex: 1 },
          { key: "changes", label: "Changes", flex: 2 },
        ],
        rows: [
          {
            id: "current",
            cells: [
              { key: "commit", value: "72d6047", mono: true },
              { key: "published", value: "15 Sep", muted: true },
              { key: "changes", value: "3 screens changed, 1 added" },
            ],
          },
          {
            id: "earlier",
            cells: [
              { key: "commit", value: "df0e956", mono: true },
              { key: "published", value: "15 Sep", muted: true },
              { key: "changes", value: "Adopt Firna controls" },
            ],
          },
        ],
      },
    },
    {
      slug: "members",
      title: "Members",
      props: {
        label: "Members",
        columns: [
          { key: "name", label: "Member", flex: 1 },
          { key: "email", label: "Email", flex: 2 },
          { key: "role", label: "Role", flex: 1 },
        ],
        rows: [
          {
            id: "cal",
            cells: [
              { key: "name", value: "Cal" },
              { key: "email", value: "cal@example.com", muted: true },
              { key: "role", value: "Owner" },
            ],
          },
        ],
      },
    },
  ],
});
