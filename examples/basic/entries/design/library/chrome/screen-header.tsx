import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { libraryMetadata } from "../metadata.js";
import {
  changeStatus,
  comparisonDestinations,
  comparisonMode,
  destination,
  flag,
  optionalText,
  text,
} from "../schemas.js";

import { ScreenHeaderView } from "./screen-header.view.js";

const propSchema = {
  kind: "object",
  properties: {
    title: text,
    crumbs: {
      schema: {
        kind: "array",
        items: {
          kind: "object",
          properties: { key: text, label: text, destination },
        },
      },
    },
    path: optionalText,
    status: { ...changeStatus, optional: true },
    comparisons: flag,
    mode: comparisonMode,
    scrollTogether: flag,
    accessible: flag,
    destinations: comparisonDestinations,
  },
} as const;
const slots = ["actions"] as const;
export type ScreenHeaderProps = ComponentProps<typeof propSchema, typeof slots>;
const home = {
  key: "home",
  label: "Catalogue home",
  destination: "design-browse-home",
} as const;
/** The Example folder has its own page, so its crumb opens that page. */
const example = {
  key: "example",
  label: "Example",
  destination: "design-browse-folder-overview",
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
  slots,
  controls: {
    title: { kind: "text", label: "Title" },
    status: {
      kind: "select",
      label: "Status",
      options: changeStatus.schema.values.map((value) => ({
        label: value,
        value,
      })),
    },
  },
  render: ScreenHeaderView,
  variants: [
    { id: "design-ui-screen-header-screen", title: "Screen", props: sample },
    {
      id: "design-ui-screen-header-component",
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
      id: "design-ui-screen-header-changed",
      title: "Changed",
      props: {
        ...sample,
        crumbs: textCrumbs,
        status: "changed",
        comparisons: true,
      },
    },
    {
      id: "design-ui-screen-header-removed",
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
