import type { Dispatch, SetStateAction } from "react";

import type { FrameNavigation } from "../client/frame_adapter.js";

import type { Catalogue } from "./catalogue.js";
import { changesActivation } from "./changes_activation.js";
import type { ShellContext } from "./context.js";
import { routeFromUrl, routeHref } from "./routes.js";
import {
  eligibleShellAnchor,
  type ShellClickEvent,
  type ShellKeyEvent,
} from "./store_browser_routes.js";
import { shellKeyDown } from "./store_interactions.js";
import type { ShellState } from "./store_state.js";

interface ShellBrowserActionInput {
  catalogue: Catalogue;
  context: ShellContext;
  navigate(href: string): Promise<void>;
  setState: Dispatch<SetStateAction<ShellState>>;
  state(): ShellState;
  transition(
    requested: URL,
    push: boolean,
    scrolls?: Readonly<Record<string, number>>,
    activated?: ReturnType<typeof routeFromUrl>,
  ): Promise<void>;
}

/** Browser-only actions returned to the React shell provider. */
export interface ShellBrowserActions {
  navigateFrame(href: string, navigation?: FrameNavigation): void;
  onShellClick(event: ShellClickEvent): void;
  onShellKeyDown(event: ShellKeyEvent): void;
  openFrame(href: string, target: string): void;
}

/** Bind DOM interactions to the browser transition owned by the store hook. */
export function shellBrowserActions(
  input: ShellBrowserActionInput,
): ShellBrowserActions {
  return {
    navigateFrame: (href) => {
      setTimeout(() => void input.navigate(href), 0);
    },
    openFrame: (href, target) => window.open(href, target, "noopener"),
    onShellClick: (event) => handleShellClick(event, input),
    onShellKeyDown: (event) =>
      shellKeyDown(event, input.setState, input.state()),
  };
}

function handleShellClick(
  event: ShellClickEvent,
  input: ShellBrowserActionInput,
): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (!target) return;
  const state = input.state();
  if (target.closest("[data-mokly-tag-toggle], [data-mokly-tag-picker]"))
    return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || !eligibleShellAnchor(event, anchor, window.location)) return;
  event.preventDefault();
  const requested = new URL(anchor.href, window.location.href);
  const route = routeFromUrl(input.catalogue, requested);
  const activated = anchor.hasAttribute("data-nav-row")
    ? changesActivation(input.catalogue, input.context, state.selection, route)
    : route;
  if (activated === route || activated.view.kind !== "target") {
    void input.navigate(requested.href);
    return;
  }
  const href = routeHref(activated.view.target.entry.path, activated.fragment, {
    ...(activated.comparison ? { comparison: activated.comparison } : {}),
    ...(activated.instance ? { instance: activated.instance } : {}),
    ...(activated.snapshot ? { snapshot: activated.snapshot } : {}),
  });
  void input.transition(new URL(href, requested), true, {}, activated);
}
