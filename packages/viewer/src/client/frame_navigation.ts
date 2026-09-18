/** Vanilla shell attachment for trusted immediate-frame navigation. */

import { attachLocalNavigation } from "./same_origin_navigation.js";

/** Callbacks owned by the outer Browse navigation lifecycle. */
export interface FrameNavigationActions {
  navigate(href: string): void;
  open(href: string, target: string): void;
}

/** Attach through the local adapter's existing-document capability. */
export function attachFrameNavigation(
  doc: Document,
  actions: FrameNavigationActions,
): void {
  attachLocalNavigation(doc, actions);
}
