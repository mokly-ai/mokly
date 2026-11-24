/**
 * The search keys of the shell, under the
 * [shell design](../../../../docs/protocol/mokly-shell-design.md#layout):
 * ⌘K and Ctrl+K move focus to the catalogue search field from anywhere in
 * the shell, and `/` does the same while focus is not in a text field. The
 * top bar binds them on the whole document of a standalone shell, and only
 * on an embedded root, so that the host page keeps its own keys. A key that
 * moves focus loses its default action, such as the browser's own search or
 * the typed `/`. Every other key keeps it. The field's key hint names `⌘K` on
 * Apple's platforms, whose keyboards carry the ⌘ key, and `Ctrl K` on every
 * other platform.
 */

import { useEffect, useSyncExternalStore } from "react";
import type { RefObject } from "react";

import type { SearchShortcut, TopBarHandle } from "@mokly/ui/top-bar";

import { listenForShellKeys } from "./canvas_input.js";
import { useShellRoot } from "./root_context.js";
import { useShellStore } from "./store_context.js";

/** The parts of a key event that decide whether it asks for the search. */
export interface SearchKeyEvent {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

/** The input types whose keys type no text, as the canvas keys read them. */
const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether keys typed at a target enter text, so they stay the field's own. */
export function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement)
    return !NON_TEXT_INPUTS.has(target.type);
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  );
}

/**
 * Whether a key is K. A layout that types Latin letters names the key by the
 * letter that it types, and any other layout, such as a Cyrillic one, by the
 * key's place.
 */
function isK({ code, key }: Pick<SearchKeyEvent, "code" | "key">): boolean {
  return /^[a-z]$/iu.test(key) ? key.toLowerCase() === "k" : code === "KeyK";
}

/**
 * Whether a key asks for the search field. ⌘K and Ctrl+K act from anywhere,
 * but not with Shift or Alt held, nor with ⌘ and Ctrl together. `/` acts
 * while focus is not in a text field and no ⌘, Ctrl or Alt is held. Some
 * layouts type `/` with Shift, so Shift does not stop it. A key of an input
 * method's composition, or one that another listener handled, never acts.
 */
export function isSearchKey(event: SearchKeyEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.altKey) return false;
  if (event.metaKey || event.ctrlKey)
    return event.metaKey !== event.ctrlKey && !event.shiftKey && isK(event);
  return event.key === "/" && !inTextField(event.target);
}

/** A user agent of Apple's platforms, an iPad's desktop agent included. */
const APPLE_AGENT = /Mac|iPhone|iPad|iPod/u;

/** The shortcut that the key hint names for a browser's user agent. */
export function searchShortcut(userAgent: string): SearchShortcut {
  return APPLE_AGENT.test(userAgent) ? "command" : "control";
}

/** The platform never changes while the shell runs. */
function subscribe(): () => void {
  return () => undefined;
}

/**
 * The shortcut that the key hint names for the reader's platform. A render
 * without a browser, such as a server render, names `⌘K`, as a static
 * depiction does.
 */
export function useSearchShortcut(): SearchShortcut {
  return useSyncExternalStore(
    subscribe,
    () =>
      searchShortcut(
        typeof navigator === "undefined" ? "" : navigator.userAgent,
      ),
    () => "command",
  );
}

/**
 * Bind the search keys of the shell while its top bar shows: on the whole
 * document of a standalone shell, and only on an embedded root. A key that
 * asks for the search moves focus through the bar's handle. So does a search
 * key that a canvas frame's document forwards, which cancelled the key in
 * its own document.
 */
export function useSearchKeys(bar: RefObject<TopBarHandle | null>): void {
  const store = useShellStore();
  const root = useShellRoot()?.elements.root;
  const embedded = store.context.embedded ?? false;
  const { interactive } = store;
  useEffect(() => {
    const element = root?.current;
    if (!interactive || !element) return;
    const keydown = (event: KeyboardEvent) => {
      const handle = bar.current;
      if (!handle || !isSearchKey(event)) return;
      event.preventDefault();
      handle.focusSearch();
    };
    if (embedded) {
      element.addEventListener("keydown", keydown);
      return () => element.removeEventListener("keydown", keydown);
    }
    const doc = element.ownerDocument;
    doc.addEventListener("keydown", keydown);
    return () => doc.removeEventListener("keydown", keydown);
  }, [bar, embedded, interactive, root]);
  useEffect(() => {
    const element = root?.current;
    if (!interactive || !element) return;
    return listenForShellKeys(
      embedded ? element : element.ownerDocument,
      (key) => {
        if (key === "search") bar.current?.focusSearch();
      },
    );
  }, [bar, embedded, interactive, root]);
}
