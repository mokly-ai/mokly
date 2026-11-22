import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { libraryMetadata } from "../metadata.js";
import {
  changeStatus,
  comparisonDestinations,
  comparisonMode,
  destination,
  enumOptions,
  flag,
  text,
  type LibraryProps,
} from "../schemas.js";

import { ScreenHeaderView } from "./screen-header.view.js";

const propSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "crumbs",
    "comparisons",
    "mode",
    "scrollTogether",
    "accessible",
    "destinations",
  ],
  properties: {
    title: text,
    crumbs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label"],
        properties: { key: text, label: text, destination },
      },
    },
    path: text,
    status: changeStatus,
    comparisons: flag,
    mode: comparisonMode,
    scrollTogether: flag,
    accessible: flag,
    destinations: comparisonDestinations,
  },
} as const;
const slots = ["actions"] as const;
export type ScreenHeaderProps = LibraryProps<typeof propSchema, typeof slots>;
const home = {
  key: "home",
  label: "Catalogue home",
  destination: CANVAS_PAGES.home,
} as const;
/**
 * The folder crumbs are text: no artboard shows the Example folder's own
 * page, and Changes and removed entries keep their folder crumbs as text.
 */
const example = { key: "example", label: "Example" } as const;
const sample = {
  title: "Welcome",
  crumbs: [home, example, { key: "screens", label: "Screens" }],
  path: "example/screens/welcome",
  comparisons: false,
  mode: "current",
  scrollTogether: true,
  accessible: true,
  destinations: {},
} as const;
export const screenHeader = defineComponent({
  ...libraryMetadata(
    "chrome",
    "screen-header",
    "Screen header",
    "Catalogue location, title, path and change status.",
  ),
  propSchema,
  props: sample,
  slots,
  controls: {
    title: { kind: "text", label: "Title" },
    status: {
      kind: "select",
      label: "Status",
      options: enumOptions(changeStatus),
    },
  },
  render: ScreenHeaderView,
  variants: [
    { slug: "screen", title: "Screen", props: sample },
    {
      slug: "component",
      title: "Component",
      props: {
        ...sample,
        crumbs: [home, example, { key: "components", label: "Components" }],
        title: "Action",
        path: "example/components/action",
        status: "unmodified",
      },
    },
    {
      slug: "changed",
      title: "Changed",
      props: {
        ...sample,
        status: "changed",
        comparisons: true,
      },
    },
    {
      slug: "removed",
      title: "Removed",
      props: {
        ...sample,
        title: "Farewell",
        path: "example/screens/farewell",
        status: "removed",
        comparisons: true,
      },
    },
  ],
});
