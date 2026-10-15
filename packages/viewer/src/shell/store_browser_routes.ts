/** Pure route comparisons and link eligibility for standalone navigation. */

import { routeDocumentKey } from "./routes.js";
import type { ShellState } from "./store_state.js";

/** The click fields the shell reads; React and native events both supply them. */
export interface ShellClickEvent {
  readonly target: EventTarget | null;
  readonly currentTarget: EventTarget | null;
  readonly defaultPrevented: boolean;
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  preventDefault(): void;
}

/** The key fields the shell reads; React and native events both supply them. */
export interface ShellKeyEvent {
  readonly key: string;
  readonly currentTarget: EventTarget | null;
  preventDefault(): void;
}

/** Whether an anchor should stay inside the standalone shell router. */
export function eligibleShellAnchor(
  event: ShellClickEvent,
  anchor: HTMLAnchorElement,
  location: Location,
): boolean {
  const url = new URL(anchor.href, location.href);
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !anchor.hasAttribute("download") &&
    (!anchor.target || anchor.target === "_self") &&
    url.origin === location.origin &&
    !(
      routeDocumentKey(url) === routeDocumentKey(new URL(location.href)) &&
      url.hash !== ""
    ) &&
    (url.pathname === "/" || url.pathname.startsWith("/view/"))
  );
}

/** Compare the complete route state without relying on object identity. */
export function sameShellRoute(
  left: ShellState["route"],
  right: ShellState["route"],
): boolean {
  if (
    left.fragment !== right.fragment ||
    left.colorScheme !== right.colorScheme ||
    left.comparison !== right.comparison ||
    left.instance !== right.instance ||
    left.snapshot !== right.snapshot ||
    left.viewport !== right.viewport ||
    left.view.kind !== right.view.kind
  )
    return false;
  if (left.view.kind === "home" || right.view.kind === "home") return true;
  if (left.view.kind === "missing" && right.view.kind === "missing")
    return left.view.requested === right.view.requested;
  return (
    left.view.kind === "target" &&
    right.view.kind === "target" &&
    left.view.target.entry.path === right.view.target.entry.path &&
    left.view.target.entry.kind === right.view.target.entry.kind
  );
}
