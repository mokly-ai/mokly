import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import { destination, flag, text, type LibraryProps } from "../schemas.js";

import { EmptyStateView } from "./empty-state.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: text,
    body: text,
    code: text,
    actionLabel: text,
    destination,
    busy: flag,
  },
} as const;
export type EmptyStateProps = LibraryProps<typeof propSchema>;

/**
 * The catalogue home's guidance. Each sample's action opens the Canvas
 * artboard of its outcome: the first screen and every screen open the
 * overview, and the catalogue home opens the Canvas home.
 */
const home = {
  title: "Mokly",
  body: "Browse the mockup catalogue generated from this repository.",
  actionLabel: "Open the first screen",
  destination: CANVAS_PAGES.overview,
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
    busy: { kind: "boolean", label: "Loading" },
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
      title: "Missing route",
      props: {
        title: "Item not found",
        body: "Nothing in the catalogue matches",
        code: "view/unknown/",
        actionLabel: "Go to the catalogue home",
        destination: CANVAS_PAGES.home,
      },
    },
    {
      slug: "no-changes",
      title: "No changes",
      props: {
        title: "No changed screens",
        body: "Your screens match the comparison baseline.",
        actionLabel: "Browse all screens →",
        destination: CANVAS_PAGES.overview,
      },
    },
  ],
});
