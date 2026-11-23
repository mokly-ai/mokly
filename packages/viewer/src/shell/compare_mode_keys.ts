/**
 * The compare mode keys of the
 * [Changes tab](../../../../docs/protocol/mokly-changes-controls.md#changes-tab):
 * while Changes is the selected tab, each key selects an offered mode unless
 * focus is in a text field. The modes take the keys in their order, from 1.
 * The keys bind on the whole document of a standalone shell, and only on an
 * embedded root, so that the host page keeps its own keys. A key that selects
 * a mode loses its default action. Every other key keeps it.
 */

import { useEffect, useRef } from "react";

import { canvasKeyCommand, type CanvasKeyEvent } from "@mokly/ui/canvas-stage";

import { useShellRoot } from "./root_context.js";
import { inTextField } from "./search_keys.js";
import { useShellStore } from "./store_context.js";

/** The parts of a key event that decide whether it selects a mode. */
export interface ModeKeyEvent extends CanvasKeyEvent {
  isComposing: boolean;
}

/** A key that names a mode by its place: `1` names the first. */
const MODE_KEY = /^[1-9]$/u;

/**
 * The mode that a key selects, or nothing. `modes` lists every mode in key
 * order: key 1 is the first. The key is the digit that the layout types,
 * the number pad's included. It acts only for a mode in `offered`, never
 * while focus is in a text field, while ⌘, Ctrl or Alt is held, during an
 * input method's composition or after another listener handled it, and never
 * for a key that the canvas binds, such as Shift+1 for Fit on a layout that
 * types digits with Shift.
 */
export function compareModeKey<Mode extends string>(
  event: ModeKeyEvent,
  modes: readonly Mode[],
  offered: readonly Mode[],
): Mode | undefined {
  if (event.defaultPrevented || event.isComposing) return undefined;
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
  if (inTextField(event.target)) return undefined;
  if (canvasKeyCommand(event) !== undefined) return undefined;
  if (!MODE_KEY.test(event.key)) return undefined;
  const mode = modes[Number(event.key) - 1];
  return mode !== undefined && offered.includes(mode) ? mode : undefined;
}

/**
 * Bind the mode keys while `enabled` and while the shell is interactive: on
 * the whole document of a standalone shell, and only on an embedded root. A
 * key that selects a mode loses its default action and calls `onMode`. The
 * listener reads the latest lists and `onMode`, so a new render of the
 * caller does not bind it again.
 */
export function useCompareModeKeys<Mode extends string>(options: {
  enabled: boolean;
  modes: readonly Mode[];
  offered: readonly Mode[];
  onMode: (mode: Mode) => void;
}): void {
  const store = useShellStore();
  const root = useShellRoot()?.elements.root;
  const embedded = store.context.embedded ?? false;
  const { interactive } = store;
  const { enabled } = options;
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const element = root?.current;
    if (!enabled || !interactive || !element) return;
    const keydown = (event: KeyboardEvent) => {
      const { modes, offered, onMode } = latest.current;
      const mode = compareModeKey(event, modes, offered);
      if (mode === undefined) return;
      event.preventDefault();
      onMode(mode);
    };
    if (embedded) {
      element.addEventListener("keydown", keydown);
      return () => element.removeEventListener("keydown", keydown);
    }
    const doc = element.ownerDocument;
    doc.addEventListener("keydown", keydown);
    return () => doc.removeEventListener("keydown", keydown);
  }, [embedded, enabled, interactive, root]);
}
