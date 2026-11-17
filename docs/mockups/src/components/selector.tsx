import { DropdownSelector } from "@firna/ui/dropdown";
import { inputSizeTokens } from "@firna/ui/input";

import { workspace, sample } from "../fixtures/product";
import type { ReactNode } from "react";

import { PendingName, TextBar } from "../screens/product/placeholders";
import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

/**
 * The repositories the saved variants choose between, from the one fixture the
 * account and settings families already read their projects from, so the list a
 * reader sees here is the list every other drawing of this workspace shows.
 */
const repositories = workspace.projects.map((project) => ({
  value: project.repository,
  label: project.repository,
  detail: project.repository === sample.repository ? "Private" : "Public",
}));

/** One choice, as the registration serializes it. */
const optionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "label"],
  properties: {
    value: { type: "string" },
    label: { type: "string" },
    detail: { type: "string" },
  },
} as const;

/** The package's own row for one choice, its detail as the secondary line. */
function packageOption(option: {
  value: string;
  label: string;
  detail?: string;
}) {
  return {
    value: option.value,
    label: option.label,
    secondary: option.detail,
  };
}

/**
 * The selector's waiting form: its label and its own trigger, read only and
 * empty, with a bar or the operation's name held where its value would be.
 * The trigger is the last part of the field, so the hold lies over its frame,
 * inset by the package's own field scale and clear of the chevron.
 */
function WaitingSelector({
  label,
  hold,
  size,
}: {
  label: string;
  hold?: ReactNode;
  size: "md" | "lg";
}) {
  const sizing = inputSizeTokens(size);
  return (
    <div className="fo-wait-field">
      <DropdownSelector
        label={label}
        value=""
        placeholder=""
        triggerLabel={label}
        options={[]}
        variant="field"
        size={size}
        searchable
        readOnly
        onValueChange={staticNoop}
        testID="firna-selector"
      />
      <span
        className="fo-wait-hold fo-wait-over"
        style={{
          height: sizing.boxHeight,
          fontSize: sizing.inputFontSize,
          paddingLeft: sizing.paddingHorizontal,
          paddingRight: sizing.paddingHorizontal + sizing.iconSize + sizing.gap,
        }}
      >
        {hold ?? <TextBar width="40%" />}
      </span>
    </div>
  );
}

export const selectorInput = componentInput({
  ...componentMetadata(
    "Selector",
    "The closed Firna select a reader opens: a labelled field carrying the chosen value, a placeholder when none is chosen, a disabled field when there is nothing to choose, and its waiting form while its choices load. Its choices may come in titled sections, which the open list draws.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "options"],
    properties: {
      label: { type: "string" },
      value: { type: "string" },
      placeholder: { type: "string" },
      disabled: { type: "boolean" },
      /**
       * The selector's waiting form while a read runs: its label and its own
       * trigger, read only, holding a bar where its value would be, or the
       * `hold` slot, the wait's name where this field is the place that
       * names it.
       */
      waiting: { type: "boolean" },
      options: { type: "array", items: optionSchema },
      /**
       * The same choices in titled groups. The package takes them in place of
       * `options`, so a chosen value is found in whichever section holds it.
       */
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "options"],
          properties: {
            title: { type: "string" },
            options: { type: "array", items: optionSchema },
          },
        },
      },
    },
  },
  props: { label: "Repository", options: repositories },
  slots: ["hold"],
  controls: {
    label: { kind: "text" },
    value: { kind: "text" },
    placeholder: { kind: "text" },
    disabled: { kind: "boolean" },
    waiting: { kind: "boolean" },
  },
  render: (
    { label, value, placeholder, disabled, waiting, options, sections, hold },
    { viewport },
  ) =>
    waiting ? (
      <WaitingSelector
        label={label}
        hold={hold}
        size={viewport === "mobile" ? "lg" : "md"}
      />
    ) : (
      <DropdownSelector
        label={label}
        value={value ?? ""}
        placeholder={placeholder}
        options={options.map(packageOption)}
        sections={sections?.map((section) => ({
          title: section.title,
          options: section.options.map(packageOption),
        }))}
        variant="field"
        size={viewport === "mobile" ? "lg" : "md"}
        searchable
        readOnly={disabled}
        onValueChange={staticNoop}
        testID="firna-selector"
      />
    ),
  variants: [
    {
      slug: "chosen",
      title: "Chosen",
      props: {
        label: "Repository",
        value: sample.repository,
        options: repositories,
      },
    },
    {
      slug: "placeholder",
      title: "Placeholder",
      props: {
        label: "Repository",
        placeholder: "Choose a repository",
        options: repositories,
      },
    },
    {
      slug: "disabled",
      title: "Disabled",
      props: {
        label: "Repository",
        placeholder: "No repositories yet",
        disabled: true,
        options: [],
      },
    },
    {
      slug: "waiting",
      title: "Waiting",
      props: { label: "Repository", waiting: true, options: [] },
      slots: { hold: <PendingName label="Loading repositories" /> },
    },
  ],
});
