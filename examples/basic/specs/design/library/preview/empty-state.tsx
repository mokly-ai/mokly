import { defineComponent } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, text, type LibraryProps } from "../schemas.js";

import { EmptyStateView } from "./empty-state.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body"],
  properties: {
    title: text,
    body: text,
    code: text,
    actionLabel: text,
    destination,
  },
} as const;
export type EmptyStateProps = LibraryProps<typeof propSchema>;
const home = {
  title: "Mokly",
  body: "Browse the mockup catalogue generated from this repository.",
  actionLabel: "Open the first screen",
  destination: DESTINATIONS.welcome,
} as const;
export const emptyState = defineComponent({
  ...libraryMetadata(
    "preview",
    "empty-state",
    "Empty state",
    "Guidance when there is no screen or comparison to display.",
  ),
  propSchema,
  props: home,
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
      props: home,
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
  ],
});
