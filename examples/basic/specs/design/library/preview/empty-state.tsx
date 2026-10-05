import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, optionalText, text } from "../schemas.js";

import { EmptyStateView } from "./empty-state.view.js";

const propSchema = {
  kind: "object",
  properties: {
    title: text,
    body: text,
    code: optionalText,
    actionLabel: optionalText,
    destination,
    links: {
      schema: {
        kind: "array",
        items: {
          kind: "object",
          properties: { label: text, destination },
        },
      },
      optional: true,
    },
  },
} as const;
export type EmptyStateProps = ComponentProps<typeof propSchema, []>;
export const emptyState = defineComponent({
  ...libraryMetadata(
    "preview",
    "empty-state",
    "Empty state",
    "Guidance when there is no screen or comparison to display.",
  ),
  propSchema,
  controls: {
    title: { kind: "text", label: "Title" },
    body: { kind: "text", label: "Description" },
    actionLabel: { kind: "text", label: "Action label" },
  },
  render: EmptyStateView,
  variants: [
    {
      slug: "home",
      title: "Catalogue home",
      props: {
        title: "Mokly",
        body: "Browse the mockup catalogue generated from this repository.",
        actionLabel: "Open the first screen",
        destination: DESTINATIONS.welcome,
      },
    },
    {
      slug: "missing-route",
      title: "Missing screen",
      props: {
        title: "Screen not found",
        body: "Nothing in the catalogue matches",
        code: "view/unknown/",
        actionLabel: "Go to the catalogue home",
        destination: DESTINATIONS.home,
      },
    },
    {
      slug: "no-changes",
      title: "No changes",
      props: {
        title: "No changed screens",
        body: "Your screens match the comparison baseline.",
        actionLabel: "Browse all screens →",
        destination: DESTINATIONS.welcome,
      },
    },
    {
      slug: "moved-variants",
      title: "Moved variants",
      props: {
        title: "This component was removed",
        body: "Its variants moved to new places.",
        links: [{ label: "Action › Quiet" }, { label: "Toolbar › Inline" }],
      },
    },
  ],
});
