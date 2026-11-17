import { Button } from "@firna/ui/button";
import { DropdownList, useDropdownSurfaceStyles } from "@firna/ui/dropdown";
import type { DropdownListEntry } from "@firna/ui/dropdown";
import { PopoverSurface } from "@firna/ui/popover";
import { View } from "react-native";
import type { ViewStyle } from "react-native";

import { Button as RegisteredButton } from "../entries/design/button.mockup";
import { Panel } from "../entries/design/panel.mockup";
import { icons } from "../screens/product/icons";
import { componentInput, componentMetadata } from "./metadata";
import { staticNoop } from "./static-controls";

/** One row of the menu, as the registration serializes it. */
interface MenuEntry {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * What one row's menu offers, in one home for its trigger and its sheet: the
 * name both carry, the sheet's title and the rows.
 */
export interface RowMenuContent {
  /** The trigger's and the menu's accessible name. */
  accessibilityLabel: string;
  /** What the compact sheet is titled: the row's own name. */
  title: string;
  entries: readonly MenuEntry[];
}

/**
 * Where the live portal places the surface for an end-aligned menu: below the
 * trigger by the package's 6px gutter, its end edge on the trigger's.
 */
const popoverPlacement: ViewStyle = {
  top: "100%",
  right: 0,
  marginTop: 6,
  minWidth: 200,
};

/**
 * The rows themselves. The popover marks the keyboard's row, the first as it
 * opens, with the library's ring rather than a solid fill; the sheet has no
 * keyboard and marks none.
 */
function MenuRows({
  label,
  entries,
  marked,
}: {
  label: string;
  entries: readonly MenuEntry[];
  marked: boolean;
}) {
  return (
    <DropdownList
      label={label}
      listRole="menu"
      activeId={marked ? (entries[0]?.id ?? null) : null}
      highlightVariant="ringFill"
      maxHeight={320}
      onClose={staticNoop}
      onActiveIdChange={staticNoop}
      entries={entries.map((entry): DropdownListEntry => ({
        id: entry.id,
        label: entry.label,
        type: "item",
        disabled: entry.disabled,
        tone: entry.danger ? "danger" : "default",
        onPress: staticNoop,
      }))}
      testID="firna-responsive-menu"
    />
  );
}

/** The wide presentation: `ResponsiveMenu`'s web popover, anchored to the trigger. */
function AnchoredMenu({
  label,
  entries,
}: {
  label: string;
  entries: readonly MenuEntry[];
}) {
  const chrome = useDropdownSurfaceStyles();
  return (
    <View style={[chrome.surface, popoverPlacement]}>
      <PopoverSurface label={label}>
        <MenuRows label={label} entries={entries} marked />
      </PopoverSurface>
    </View>
  );
}

/**
 * The compact presentation: the same rows in a bottom sheet titled with the
 * row's name. The live sheet portals to the document root, so it is never
 * drawn inside the row. The registration on its own draws it in a layer fixed
 * over the whole surface. A settings pane draws it in its modal slot instead,
 * so the frame beneath is inert, as it is beneath the live modal frame.
 */
export function MenuSheet({
  accessibilityLabel,
  title,
  entries,
}: RowMenuContent) {
  return (
    <Panel
      moklyInstance="row-menu-sheet"
      label={accessibilityLabel}
      header={<span className="fo-viewer-panel-title">{title}</span>}
      actions={
        <RegisteredButton
          moklyInstance="row-menu-cancel"
          label="Cancel"
          tone="quiet"
          size="sm"
        />
      }
    >
      <MenuRows label={accessibilityLabel} entries={entries} marked={false} />
    </Panel>
  );
}

/**
 * A row's own actions behind one icon-only trigger. The live row opens Firna's
 * `ResponsiveMenu` on a wide surface and, on a compact one, the settings modal
 * frame — the package's `WebModalFrame` placed as a bottom sheet — holding the
 * same rows. Both portal from effects and draw nothing in static markup, so
 * this registration composes their public parts instead: the popover surface
 * and list in the package's surface chrome on a pointer viewport, and the
 * registered panel's bottom sheet on a touch one. A host that draws that sheet
 * in its own modal slot, as a settings pane does, sets `hostedSheet`, so the
 * row draws only its expanded trigger there.
 */
export const responsiveMenuInput = componentInput({
  ...componentMetadata(
    "Responsive menu",
    "A row's actions behind a three-dot trigger: an anchored popover on desktop and a bottom sheet on mobile.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["accessibilityLabel", "title", "entries"],
    properties: {
      accessibilityLabel: { type: "string" },
      title: { type: "string" },
      open: { type: "boolean" },
      hostedSheet: { type: "boolean" },
      entries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "label"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            danger: { type: "boolean" },
            disabled: { type: "boolean" },
          },
        },
      },
    },
  },
  props: {
    accessibilityLabel: "Actions for GitHub Actions",
    title: "GitHub Actions",
    entries: [{ id: "revoke", label: "Revoke", danger: true }],
  },
  controls: {
    accessibilityLabel: { kind: "text", label: "Trigger name" },
    title: { kind: "text", label: "Sheet title" },
    open: { kind: "boolean" },
    hostedSheet: { kind: "boolean", label: "Host draws the sheet" },
  },
  render: (
    { accessibilityLabel, title, open, hostedSheet, entries },
    { viewport },
  ) => (
    <div className="fo-row-menu">
      <Button
        accessibilityLabel={accessibilityLabel}
        tone="plain"
        shape="square"
        size="sm"
        icon={icons.more}
        hasPopup="menu"
        expanded={Boolean(open)}
        minTouchTarget={viewport === "mobile" ? 44 : undefined}
        hitSlop={viewport === "mobile" ? undefined : 8}
        onPress={staticNoop}
        testID="firna-responsive-menu-trigger"
      />
      {open && viewport === "desktop" && (
        <AnchoredMenu label={accessibilityLabel} entries={entries} />
      )}
      {open && viewport === "mobile" && !hostedSheet && (
        <div className="fo-menu-sheet-layer">
          <MenuSheet
            accessibilityLabel={accessibilityLabel}
            title={title}
            entries={entries}
          />
        </div>
      )}
    </div>
  ),
  variants: [
    {
      slug: "closed",
      title: "Closed",
      props: {
        accessibilityLabel: "Actions for GitHub Actions",
        title: "GitHub Actions",
        entries: [{ id: "revoke", label: "Revoke", danger: true }],
      },
    },
    {
      slug: "open",
      title: "Open",
      props: {
        accessibilityLabel: "Actions for GitHub Actions",
        title: "GitHub Actions",
        open: true,
        entries: [{ id: "revoke", label: "Revoke", danger: true }],
      },
    },
  ],
});
