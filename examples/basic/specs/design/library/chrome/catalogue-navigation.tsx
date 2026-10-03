import { defineComponent, type ComponentProps } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { NAV_TREE, NAV_TREE_VARIANTS_OPEN } from "../../parts/nav_data.js";
import { CHANGED_VARIANT_ROWS } from "../../parts/variant_nav_data.js";
import { libraryMetadata } from "../metadata.js";
import { destination, flag, optionalText, text } from "../schemas.js";

import { CatalogueNavigationView } from "./catalogue-navigation.view.js";

const propSchema = {
  kind: "object",
  properties: {
    rows: {
      schema: {
        kind: "array",
        items: {
          kind: "object",
          properties: {
            key: text,
            label: text,
            kind: {
              schema: {
                kind: "enum",
                values: [
                  "folder",
                  "screen",
                  "component",
                  "flow",
                  "page",
                  "document",
                  "variant",
                ],
              },
            },
            depth: { schema: { kind: "number", minimum: 0, integer: true } },
            count: {
              schema: { kind: "number", minimum: 0, integer: true },
              optional: true,
            },
            changed: { ...flag, optional: true },
            moved: { ...flag, optional: true },
            open: { ...flag, optional: true },
            variants: {
              schema: { kind: "enum", values: ["open", "closed"] },
              optional: true,
            },
            variantParentKind: {
              schema: { kind: "enum", values: ["screen", "component"] },
              optional: true,
            },
            to: destination,
          },
        },
      },
    },
    activeDestination: destination,
    activeKey: optionalText,
    activeLabel: optionalText,
    changedCount: { schema: { kind: "number", minimum: 0, integer: true } },
    changedOnly: flag,
    changesStatus: {
      schema: {
        kind: "enum",
        values: ["ready", "pending", "preparing", "unavailable"],
      },
      optional: true,
    },
    showChanges: { ...flag, optional: true },
    presentation: {
      schema: { kind: "enum", values: ["responsive", "drawer"] },
    },
    allDestination: destination,
    changesDestination: destination,
  },
} as const;
export type CatalogueNavigationProps = ComponentProps<typeof propSchema, []>;
const sample = {
  rows: NAV_TREE,
  activeDestination: "design/browse/views/screen",
  changedCount: 1,
  changedOnly: false,
  presentation: "responsive",
  allDestination: "design/browse/views/screen",
  changesDestination: "design/changes/diff-controls/current",
} as const;
export const catalogueNavigation = defineComponent({
  ...libraryMetadata(
    "chrome",
    "catalogue-navigation",
    "Catalogue navigation",
    "The catalogue tree and its All or Changes filter.",
    ["catalogue-navigation-row.view.tsx"],
  ),
  propSchema,
  controls: {
    changedOnly: { kind: "boolean", label: "Changes only" },
    changesStatus: {
      kind: "select",
      label: "Changes availability",
      options: [
        { label: "Ready", value: "ready" },
        { label: "Checking", value: "pending" },
        { label: "Preparing", value: "preparing" },
        { label: "Unavailable", value: "unavailable" },
      ],
    },
    presentation: {
      kind: "select",
      label: "Presentation",
      options: [
        { label: "Responsive", value: "responsive" },
        { label: "Drawer", value: "drawer" },
      ],
    },
  },
  render: (props, context) => (
    <CatalogueNavigationView {...props} viewport={context.viewport} />
  ),
  variants: [
    {
      slug: "all",
      title: "All entries",
      props: sample,
    },
    {
      slug: "changes",
      title: "Changes",
      props: { ...sample, changedOnly: true, rows: NAV_TREE.slice(0, 3) },
    },
    {
      slug: "empty",
      title: "Empty",
      props: { ...sample, rows: [], changedCount: 0, changedOnly: true },
    },
    {
      slug: "drawer",
      title: "Drawer",
      props: { ...sample, presentation: "drawer" },
    },
    {
      slug: "loading",
      title: "Checking for changes",
      props: { ...sample, changedOnly: true, changesStatus: "pending" },
    },
    {
      slug: "preparing",
      title: "Preparing comparison",
      props: { ...sample, changedOnly: true, changesStatus: "preparing" },
    },
    {
      slug: "unavailable",
      title: "Changes unavailable",
      props: { ...sample, changedOnly: true, changesStatus: "unavailable" },
    },
    {
      slug: "variants",
      title: "Screen variants",
      props: {
        ...sample,
        activeDestination: DESTINATIONS.variantSelected,
        rows: NAV_TREE_VARIANTS_OPEN,
      },
    },
    {
      slug: "changed-variants",
      title: "Changed variant",
      props: {
        activeLabel: "Save failed",
        allDestination: DESTINATIONS.variantSelected,
        changedCount: 1,
        changedOnly: true,
        changesDestination: DESTINATIONS.variantChanges,
        presentation: "responsive",
        rows: CHANGED_VARIANT_ROWS,
      },
    },
  ],
});
