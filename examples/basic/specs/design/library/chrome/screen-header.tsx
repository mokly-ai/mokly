import { defineComponent } from "@mokly/mokly";

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
  destination: "design/browse/views/home",
} as const;
/** The Example folder has its own page, so its crumb opens that page. */
const example = {
  key: "example",
  label: "Example",
  destination: "design/browse/views/folder-overview",
} as const;
/** Changes and removed entries keep their folder crumbs as text. */
const textCrumbs = [
  home,
  { key: "example", label: "Example" },
  { key: "screens", label: "Screens" },
] as const;
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
        crumbs: textCrumbs,
        status: "changed",
        comparisons: true,
      },
    },
    {
      slug: "removed",
      title: "Removed",
      props: {
        ...sample,
        crumbs: textCrumbs,
        title: "Farewell",
        path: "example/screens/farewell",
        status: "removed",
        comparisons: true,
      },
    },
  ],
});
