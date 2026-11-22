import { defineComponent } from "@mokly/mokly";

import { CANVAS_PAGES } from "../../canvas/parts/destinations.js";
import { CANVAS_ALL_ROWS, retarget } from "../../canvas/parts/nav_rows.js";
import { PROFILE_CHANGES_ROWS } from "../../parts/account_nav_data.js";
import {
  NAV_TREE_PROFILE_OPEN,
  NAV_TREE_VARIANTS_OPEN,
} from "../../parts/nav_data.js";
import { CHANGED_VARIANT_ROWS } from "../../parts/variant_nav_data.js";
import { libraryMetadata } from "../metadata.js";
import { destination, flag, text, type LibraryProps } from "../schemas.js";

import { CatalogueNavigationView } from "./catalogue-navigation.view.js";

const count = { type: "integer", minimum: 0 } as const;
const propSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rows", "changedCount", "changedOnly", "presentation"],
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "kind", "depth"],
        properties: {
          key: text,
          label: text,
          kind: {
            enum: [
              "folder",
              "screen",
              "component",
              "flow",
              "page",
              "document",
              "variant",
            ],
          },
          depth: count,
          count,
          changed: flag,
          moved: flag,
          open: flag,
          variants: { enum: ["open", "closed"] },
          contents: flag,
          variantParentKind: { enum: ["screen", "component"] },
          to: destination,
        },
      },
    },
    activeDestination: destination,
    activeKey: text,
    activeLabel: text,
    changedCount: count,
    changedOnly: flag,
    changesStatus: { enum: ["ready", "pending", "preparing", "unavailable"] },
    showChanges: flag,
    presentation: { enum: ["responsive", "drawer"] },
    allDestination: destination,
    changesDestination: destination,
  },
} as const;
export type CatalogueNavigationProps = LibraryProps<typeof propSchema>;
type NavigationRows = CatalogueNavigationProps["rows"];

/** The Canvas artboard that each canonical row opens from All, by its key. */
const ALL_TARGETS = new Map(
  CANVAS_ALL_ROWS.flatMap((row) =>
    row.to === undefined ? [] : [[row.key, row.to] as const],
  ),
);

/**
 * Rows in All, each opening the Canvas artboard of its entry, as the Canvas
 * catalogue's rows do; a row that no Canvas artboard shows is a picture.
 */
function inAll(rows: NavigationRows): NavigationRows {
  return rows.map((row) => retarget(row, ALL_TARGETS.get(row.key)));
}

/** Rows that no Canvas artboard shows, each a picture of itself. */
function pictures(rows: NavigationRows): NavigationRows {
  return rows.map((row) => retarget(row, undefined));
}

/**
 * Own props hold only keys that every variant sets, so no variant inherits a
 * selection. Welcome's catalogue opens the Canvas artboards: each filter the
 * other view with Welcome selected, and each row its entry.
 */
const base = {
  rows: CANVAS_ALL_ROWS,
  changedCount: 1,
  changedOnly: false,
  presentation: "responsive",
  allDestination: CANVAS_PAGES.overview,
  changesDestination: CANVAS_PAGES.catalogue,
} as const;
const sample = {
  ...base,
  activeDestination: CANVAS_PAGES.overview,
} as const;
export const catalogueNavigation = defineComponent({
  ...libraryMetadata(
    "chrome",
    "catalogue-navigation",
    "Catalogue navigation",
    "The catalogue tree and its All or Changes filter.",
  ),
  propSchema,
  props: base,
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
      props: {
        ...sample,
        changedOnly: true,
        rows: CANVAS_ALL_ROWS.slice(0, 3),
      },
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
    // No Canvas artboard shows a Welcome variant, Welcome's changed variant,
    // or Profile's members selected, nor these states in the other filter,
    // so those rows and filters are pictures.
    {
      slug: "variants",
      title: "Screen variants",
      props: {
        activeKey: "welcome-empty",
        changedCount: 1,
        changedOnly: false,
        presentation: "responsive",
        rows: inAll(NAV_TREE_VARIANTS_OPEN),
      },
    },
    {
      slug: "changed-variants",
      title: "Changed variant",
      props: {
        activeLabel: "Save failed",
        changedCount: 1,
        changedOnly: true,
        presentation: "responsive",
        rows: pictures(CHANGED_VARIANT_ROWS),
      },
    },
    {
      slug: "folder-screen",
      title: "Folder screen",
      props: {
        activeDestination: CANVAS_PAGES.unchanged,
        changedCount: 1,
        changedOnly: false,
        presentation: "responsive",
        rows: inAll(NAV_TREE_PROFILE_OPEN),
      },
    },
    {
      slug: "changed-member",
      title: "Changed folder member",
      props: {
        activeKey: "profile-security",
        changedCount: 1,
        changedOnly: true,
        presentation: "responsive",
        rows: pictures(PROFILE_CHANGES_ROWS),
      },
    },
  ],
});
