import { SkeletonGroup } from "@firna/ui/skeleton";
import type { ReactNode } from "react";

import { ContentList } from "../entries/design/content-list.mockup";
import { Input } from "../entries/design/input.mockup";
import { Selector } from "../entries/design/selector.mockup";
import { Table } from "../entries/design/table.mockup";
import { Facts, Pending } from "../screens/product/page-parts";
import {
  ControlPlaceholder,
  factPlaceholder,
  StatePlaceholder,
  TextBar,
} from "../screens/product/placeholders";

import { componentInput, componentMetadata } from "./metadata";

/** The placeholder forms of the Wait composition that the variants draw. */
const forms = ["project", "field", "control", "rows", "state"] as const;

/** A heading whose text the answer supplies, as a bar of its line height. */
function HeadingBar() {
  return (
    <div
      style={{
        fontSize: "var(--mk-type-heading3-size)",
        lineHeight: "var(--mk-type-heading3-line)",
      }}
    >
      <TextBar width="10em" />
    </div>
  );
}

/**
 * One form inside its waiting region. A form with a text place whose text the
 * answer decides shows the operation's name there: the field that waits, or
 * the state card's title. The others name it for screen readers only.
 */
function WaitingForm({
  label,
  form,
}: {
  label: string;
  form: (typeof forms)[number];
}): ReactNode {
  if (form === "field")
    return (
      <Pending label={label}>
        {(name) => (
          <>
            <Input
              label="Config path"
              name="waiting-config-path"
              type="text"
              waiting
            />
            <Selector label="Repository" waiting options={[]} hold={name} />
          </>
        )}
      </Pending>
    );
  if (form === "state")
    return (
      <Pending label={label}>
        {(name) => <StatePlaceholder title={name} />}
      </Pending>
    );
  return (
    <Pending label={label} labelMode="screen-reader-only">
      {form === "project" ? (
        <>
          <HeadingBar />
          <Facts
            ruled
            rows={[factPlaceholder("Address"), factPlaceholder("Repository")]}
          />
        </>
      ) : form === "control" ? (
        <>
          <ControlPlaceholder />
          <ControlPlaceholder size="md" width={120} />
        </>
      ) : (
        <>
          <ContentList
            label="Projects"
            rows={[
              {
                id: "waiting",
                title: "",
                detail: "",
                waiting: true,
              },
            ]}
          />
          <Table
            label="Members"
            columns={[
              { key: "name", label: "Member", flex: 1 },
              { key: "role", label: "Role", flex: 1 },
            ]}
            rows={[
              {
                id: "waiting",
                waiting: true,
                cells: [
                  { key: "name", value: "" },
                  { key: "role", value: "" },
                ],
              },
            ]}
          />
        </>
      )}
    </Pending>
  );
}

export const skeletonInput = componentInput({
  ...componentMetadata(
    "Skeleton",
    "The placeholder forms a wait draws in place of the parts its answer fills, each at its part's own size, inside the waiting region that names the operation.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "form"],
    properties: {
      /** The operation the waiting region names. */
      label: { type: "string" },
      form: { enum: forms },
    },
  },
  props: { label: "Loading project", form: "project" },
  controls: {
    label: { kind: "text" },
    form: {
      kind: "select",
      options: forms.map((value) => ({ label: value, value })),
    },
  },
  render: ({ label, form }) => (
    <div className="loading-layout">
      <SkeletonGroup direction="column">
        <WaitingForm label={label} form={form} />
      </SkeletonGroup>
    </div>
  ),
  variants: [
    {
      slug: "project",
      title: "Project loading",
      props: { label: "Loading project", form: "project" },
    },
    {
      slug: "field",
      title: "Field waiting",
      props: { label: "Loading repositories", form: "field" },
    },
    {
      slug: "control",
      title: "Control waiting",
      props: { label: "Loading your workspace", form: "control" },
    },
    {
      slug: "rows",
      title: "Rows waiting",
      props: { label: "Loading projects", form: "rows" },
    },
    {
      slug: "state",
      title: "State waiting",
      props: { label: "Opening your workspace", form: "state" },
    },
  ],
});
