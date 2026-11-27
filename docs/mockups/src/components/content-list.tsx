import { List, ListItem } from "@firna/ui/list";
import { StatusDot } from "@firna/ui/status-dot";

import { MockLink } from "@mokly/mokly";

import { WaitingListRow } from "../screens/product/placeholder-rows";

import { componentInput, componentMetadata } from "./metadata";

const tones = {
  neutral: "neutral",
  success: "primary",
  warning: "warning",
  danger: "danger",
} as const;

export const contentListInput = componentInput({
  ...componentMetadata(
    "Content list",
    "Shared rows with a status, aligned metadata, and a whole-row link or choice.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "rows"],
    properties: {
      label: { type: "string" },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            detail: { type: "string" },
            /** Where the row leads: the whole row is the link, or the button of a choice. */
            to: { type: "string" },
            status: { enum: ["neutral", "success", "warning", "danger"] },
            meta: { type: "string" },
            mono: { type: "boolean" },
            choose: { type: "boolean" },
            /**
             * The row while the list's read runs: its own frame with bars in
             * place of its text, not the package's loading rows, whose
             * heights differ from these rows.
             */
            waiting: { type: "boolean" },
          },
        },
      },
    },
  },
  props: {
    label: "Projects",
    rows: [
      {
        id: "cloud",
        title: "Mokly Cloud",
        detail: "mokly-ai/mokly-cloud",
        to: "product/settings/project",
      },
    ],
  },
  controls: { label: { kind: "text" } },
  render: ({ label, rows }, { viewport }) => {
    const size = viewport === "mobile" ? "md" : "sm";
    return (
      <List
        accessibilityLabel={label}
        items={[...rows]}
        itemKey={(row) => row.id}
        size={size}
        testID="firna-content-list"
        renderItem={(row) => {
          if (row.waiting) return <WaitingListRow row={row} size={size} />;
          const item = (
            <ListItem
              size={size}
              title={row.title}
              description={row.detail}
              leading={
                row.status ? (
                  <StatusDot tone={tones[row.status]} size="sm" />
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
          );
          return (
            <div className="content-list-row">
              {!row.to ? (
                item
              ) : row.choose ? (
                <MockLink className="row-choice" to={row.to}>
                  {item}
                </MockLink>
              ) : (
                <MockLink className="row-link" to={row.to}>
                  {item}
                </MockLink>
              )}
            </div>
          );
        }}
      />
    );
  },
  variants: [
    {
      slug: "projects",
      title: "Project",
      props: {
        label: "Projects",
        rows: [
          {
            id: "cloud",
            title: "Mokly Cloud",
            detail: "mokly-ai/mokly-cloud",
            to: "product/settings/project",
          },
        ],
      },
    },
    {
      slug: "members",
      title: "Member",
      props: {
        label: "Members",
        rows: [{ id: "cal", title: "Cal", detail: "Owner" }],
      },
    },
    {
      slug: "choices",
      title: "Choice",
      props: {
        label: "Screens in this publication",
        rows: [
          { id: "home", title: "Home", meta: "Selected" },
          {
            id: "pricing",
            title: "Pricing",
            to: "product/viewer/share",
            choose: true,
          },
        ],
      },
    },
  ],
});
