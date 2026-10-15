import { defineComponent } from "@mokly/mokly";

import { PROFILE_CHANGES_ROWS } from "../../parts/account_nav_data.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import {
  NAV_TREE,
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
/** Own props hold only keys that every variant sets, so no variant inherits a selection. */
const base = {
  rows: NAV_TREE,
  changedCount: 1,
  changedOnly: false,
  presentation: "responsive",
  allDestination: "design/browse/views/screen",
  changesDestination: "design/changes/diff-controls/current",
} as const;
const sample = {
  ...base,
  activeDestination: "design/browse/views/screen",
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
    {
      slug: "folder-screen",
      title: "Folder screen",
      props: {
        activeDestination: DESTINATIONS.indexEntry,
        allDestination: DESTINATIONS.indexEntry,
        changedCount: 1,
        changedOnly: false,
        changesDestination: DESTINATIONS.indexEntryChanges,
        presentation: "responsive",
        rows: NAV_TREE_PROFILE_OPEN,
      },
    },
    {
      slug: "changed-member",
      title: "Changed folder member",
      props: {
        activeKey: "profile-security",
        allDestination: DESTINATIONS.indexMember,
        changedCount: 1,
        changedOnly: true,
        changesDestination: DESTINATIONS.indexMemberChanges,
        presentation: "responsive",
        rows: PROFILE_CHANGES_ROWS,
      },
    },
  ],
});
