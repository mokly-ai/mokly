import { DropdownList, useDropdownSurfaceStyles } from "@firna/ui/dropdown";
import type { DropdownListEntry } from "@firna/ui/dropdown";
import { InputFrame } from "@firna/ui/input";
import { Search } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";

import { githubAccounts, sample } from "../fixtures/product";

import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

/** One row, as the registration serializes it. */
interface Option {
  id: string;
  label: string;
  detail?: string;
}

const optionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    detail: { type: "string" },
  },
} as const;

/**
 * The rows the package lists. Titled sections take the place of the flat
 * options, each title its own row ahead of the options it holds, exactly as
 * the package's selector builds them from its `sections`.
 */
function listEntries(
  options: readonly Option[],
  sections: readonly { title: string; options: readonly Option[] }[] = [],
  selected: string,
): DropdownListEntry[] {
  const row = (option: Option): DropdownListEntry => ({
    id: option.id,
    label: option.label,
    secondary: option.detail,
    type: "item",
    selected: option.id === selected,
    onPress: staticNoop,
  });
  if (sections.length === 0) return options.map(row);
  return sections.flatMap((section, index) => [
    { id: "section-" + index, label: section.title, type: "section" as const },
    ...section.options.map(row),
  ]);
}

/** The connected accounts' repositories, one titled section per account. */
const accountSections = githubAccounts.map((account) => ({
  title: account.name,
  options: account.repositories.map((repository) => ({
    id: repository.name,
    label: repository.name,
    detail: repository.visibility,
  })),
}));

/**
 * Where the live portal places a select's surface: beneath the field by the
 * package's 6px gutter and no narrower than it, which on the account panel is
 * the field's own width.
 */
const surfacePlacement: ViewStyle = {
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 6,
};

/**
 * The open surface of a select: the package's own dropdown chrome, anchored
 * beneath the field. The live portal measures the field and draws from an
 * effect, so static markup composes the same chrome around the same list.
 */
function SelectSurface({ children }: { children: ReactNode }) {
  const chrome = useDropdownSurfaceStyles();
  return <View style={[chrome.surface, surfacePlacement]}>{children}</View>;
}

export const optionsListInput = componentInput({
  ...componentMetadata(
    "Options list",
    "Public Firna dropdown rows for an open selector; the chosen row is a soft tint, a ring and a check, never a solid fill. Titled sections group the rows, a search field leads a searchable select's list, and anchored draws the list as the open surface beneath its field.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["label", "selected", "options"],
    properties: {
      label: { type: "string" },
      selected: { type: "string" },
      options: { type: "array", items: optionSchema },
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
      /** The search field's placeholder; a list with none draws no field. */
      search: { type: "string" },
      anchored: { type: "boolean" },
    },
  },
  props: {
    label: "Repository",
    selected: "cloud",
    options: [
      {
        id: "cloud",
        label: "mokly-ai/mokly-cloud",
        detail: "Private repository",
      },
    ],
  },
  controls: {
    label: { kind: "text" },
    search: { kind: "text" },
    anchored: { kind: "boolean" },
  },
  render: ({ label, options, selected, sections, search, anchored }) => {
    const list = (
      <DropdownList
        label={label}
        activeId={selected}
        highlightVariant="ringFill"
        maxHeight={320}
        onClose={staticNoop}
        onActiveIdChange={staticNoop}
        search={
          search === undefined ? undefined : (
            <InputFrame
              accessibilityLabel={search}
              placeholder={search}
              prefixIcon={Search}
              size="sm"
              value=""
              onChangeText={staticNoop}
            />
          )
        }
        entries={listEntries(options, sections, selected)}
        testID="firna-options-list"
      />
    );
    return anchored ? <SelectSurface>{list}</SelectSurface> : list;
  },
  variants: [
    {
      slug: "selected",
      title: "Selected",
      props: {
        label: "Repository",
        selected: "cloud",
        options: [
          {
            id: "cloud",
            label: "mokly-ai/mokly-cloud",
            detail: "Private repository",
          },
        ],
      },
    },
    {
      slug: "empty",
      title: "No matches",
      props: { label: "Repository", selected: "", options: [] },
    },
    {
      slug: "sections",
      title: "Sections",
      props: {
        label: "Repository",
        selected: sample.repository,
        options: [],
        search: "Search options",
        sections: accountSections,
      },
    },
  ],
});
