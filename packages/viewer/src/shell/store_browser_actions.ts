import type {
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  SetStateAction,
} from "react";

import type { FrameNavigation } from "../client/frame_adapter.js";

import type { Catalogue } from "./catalogue.js";
import { changesActivation } from "./changes_activation.js";
import type { ShellContext } from "./context.js";
import { routeFromUrl, routeHref } from "./routes.js";
import { eligibleShellAnchor } from "./store_browser_routes.js";
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
  onShellClick(event: MouseEvent<HTMLElement>): void;
  onShellKeyDown(event: KeyboardEvent<HTMLElement>): void;
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
    onShellKeyDown: (event) => handleShellKeyDown(event, input),
  };
}

function handleShellClick(
  event: MouseEvent<HTMLElement>,
  input: ShellBrowserActionInput,
): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (!target) return;
  const state = input.state();
  const outsidePickerTag =
    target.closest("[data-mokly-tag]") &&
    !target.closest("[data-mokly-tag-picker]");
  if (
    state.tagPickerOpen &&
    !target.closest("[data-mokly-tag-toggle], [data-mokly-tag-picker]")
  ) {
    input.setState((current) => ({ ...current, tagPickerOpen: false }));
    if (outsidePickerTag) {
      const root = event.currentTarget;
      queueMicrotask(() =>
        root.querySelector<HTMLElement>("[data-mokly-tag-toggle]")?.focus(),
      );
    }
  }
  if (target.closest("[data-mokly-tag-toggle], [data-mokly-tag-picker]"))
    return;
  if (state.expandedFrame && !target.closest(".browser-frame.is-expanded"))
    input.setState((current) => ({ ...current, expandedFrame: undefined }));
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
  const href = routeHref(
    activated.view.target.entry.kind,
    activated.view.target.entry.id,
    activated.fragment,
    {
      ...(activated.comparison ? { comparison: activated.comparison } : {}),
      ...(activated.instance ? { instance: activated.instance } : {}),
      ...(activated.snapshot ? { snapshot: activated.snapshot } : {}),
    },
  );
  void input.transition(new URL(href, requested), true, {}, activated);
}

function handleShellKeyDown(
  event: KeyboardEvent<HTMLElement>,
  input: ShellBrowserActionInput,
): void {
  if (event.key !== "Escape") return;
  if (input.state().tagPickerOpen) {
    event.preventDefault();
    input.setState((state) => ({ ...state, tagPickerOpen: false }));
    event.currentTarget
      .querySelector<HTMLElement>("[data-mokly-tag-toggle]")
      ?.focus();
  } else if (input.state().expandedFrame) {
    event.preventDefault();
    input.setState((state) => ({ ...state, expandedFrame: undefined }));
  }
}
