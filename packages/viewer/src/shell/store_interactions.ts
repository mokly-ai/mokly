/** Input rules shared by standalone and embedded shell roots. */

import { useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { ShellKeyEvent } from "./store_browser_routes.js";
import type { ShellStore } from "./store_context.js";
import type { ShellState } from "./store_state.js";

/** Escape closes the picker before the expanded frame. */
export function shellKeyDown(
  event: ShellKeyEvent,
  setState: Dispatch<SetStateAction<ShellState>>,
  state: ShellState,
): void {
  if (event.key !== "Escape") return;
  if (state.tagPickerOpen) {
    event.preventDefault();
    setState((current) => ({ ...current, tagPickerOpen: false }));
    const root = event.currentTarget;
    if (root instanceof Element)
      root.querySelector<HTMLElement>("[data-mokly-tag-toggle]")?.focus();
  } else if (state.expandedFrame) {
    event.preventDefault();
    setState((current) => ({ ...current, expandedFrame: undefined }));
  }
}

/** Dismiss overlays on any outside click, including outside an embedded root. */
function dismissOverlays(
  target: Element,
  root: HTMLElement,
  store: ShellStore,
): void {
  const picker = target.closest(
    "[data-mokly-tag-toggle], [data-mokly-tag-picker]",
  );
  if (picker && root.contains(picker)) return;
  if (store.state.tagPickerOpen) {
    const panel = root.querySelector("[data-mokly-tag-picker]");
    const heldFocus = panel?.contains(root.ownerDocument.activeElement);
    store.setTagPicker(false);
    if (heldFocus)
      root.querySelector<HTMLElement>("[data-mokly-tag-toggle]")?.focus();
  }
  const frame = target.closest(".browser-frame.is-expanded");
  if (store.state.expandedFrame && !(frame && root.contains(frame)))
    store.setExpandedFrame(undefined);
}

/** Observe outside clicks in either delivery and bind standalone native input. */
export function useShellBindings(
  root: RefObject<HTMLElement | null>,
  store: ShellStore,
): void {
  const latest = useRef(store);
  latest.current = store;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const doc = element.ownerDocument;
    const click = (event: MouseEvent) => {
      const current = latest.current;
      if (!current.interactive || !(event.target instanceof Element)) return;
      dismissOverlays(event.target, element, current);
      if (!current.context.embedded) current.onShellClick(event);
    };
    const keydown = (event: KeyboardEvent) => {
      const current = latest.current;
      if (!current.interactive) return;
      if (!current.context.embedded)
        current.onShellKeyDown({
          currentTarget: element,
          key: event.key,
          preventDefault: () => event.preventDefault(),
        });
    };
    doc.addEventListener("click", click);
    doc.addEventListener("keydown", keydown);
    return () => {
      doc.removeEventListener("click", click);
      doc.removeEventListener("keydown", keydown);
    };
  }, [root]);
}
