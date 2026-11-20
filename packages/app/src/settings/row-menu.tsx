import { Button } from "@firna/ui/button";
import { DropdownList } from "@firna/ui/dropdown";
import type { DropdownListEntry } from "@firna/ui/dropdown";
import { ResponsiveMenu } from "@firna/ui/popover";
import { useCallback, useMemo, useRef, useState } from "react";
import type { View } from "react-native";

import { Action } from "../components/action";
import { icons } from "../components/icons";
import { useCompact } from "../layout/viewport";

import { SettingsModal } from "./modal";

/** One of a row's own actions. */
export interface RowMenuEntry {
  id: string;
  label: string;
  /** Destructive, so the row takes the package's danger ink. */
  danger?: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * A row's own actions behind one three-dot trigger, named for the row, so a
 * list of rows carries one control each rather than a line of competing
 * buttons. On a pointer surface the menu is the package's `ResponsiveMenu`, a
 * non-modal popover anchored below the trigger at its end edge; on a compact
 * one it is a bottom sheet titled with the row's name, in the same frame every
 * other compact overlay in settings uses. Choosing a row closes the menu before
 * the row's own action runs, so whatever that action opens is the one overlay.
 *
 * The popover marks the keyboard's row with a ring rather than a solid fill,
 * because it marks the first row as the menu opens and a destructive row filled
 * red reads as already chosen; the sheet marks none, having no keyboard.
 */
export function RowMenu({
  label,
  title,
  entries,
  testID,
}: {
  /** The trigger's and the menu's accessible name. */
  label: string;
  /** What the compact sheet is titled: the row's own name. */
  title: string;
  entries: readonly RowMenuEntry[];
  testID?: string;
}) {
  const compact = useCompact();
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const rows = useMemo(
    () =>
      entries.map((entry): DropdownListEntry => ({
        id: entry.id,
        label: entry.label,
        type: "item",
        tone: entry.danger ? "danger" : "default",
        testID: entry.testID,
        onPress: () => {
          setOpen(false);
          entry.onPress();
        },
      })),
    [entries],
  );
  return (
    <div className="fo-row-menu">
      <Button
        accessibilityLabel={label}
        tone="plain"
        shape="square"
        size="sm"
        icon={icons.more}
        hasPopup="menu"
        expanded={open}
        // The same touch-target rule as `Action`: 44px on a compact surface,
        // the control's own scale with a wider hit area under a pointer.
        minTouchTarget={compact ? 44 : undefined}
        hitSlop={compact ? undefined : 8}
        buttonRef={anchor}
        onPress={() => setOpen((current) => !current)}
        testID={testID}
      />
      {compact ? (
        open && (
          <SettingsModal
            title={title}
            onClose={close}
            actions={
              <Action label="Cancel" tone="quiet" size="sm" onPress={close} />
            }
            testID={testID && testID + "-sheet"}
          >
            <DropdownList
              label={label}
              listRole="menu"
              entries={rows}
              activeId={null}
              maxHeight={320}
              onClose={close}
            />
          </SettingsModal>
        )
      ) : (
        <ResponsiveMenu
          label={label}
          anchorRef={anchor}
          open={open}
          onClose={close}
          entries={rows}
          align="end"
          highlightVariant="ringFill"
          minWidth={200}
          maxHeight={320}
          testID={testID && testID + "-popover"}
        />
      )}
    </div>
  );
}
