/** Pure route projection and input handling for application-owned shell roots. */

import type {
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  SetStateAction,
} from "react";

import type { FrameNavigation } from "../client/frame_adapter.js";
import { routedEntries } from "../viewer/selection.js";
import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import { changesActivation } from "./changes_activation.js";
import type { ShellContext } from "./context.js";
import { disclosurePath } from "./nav_model.js";
import type { NavSectionNode } from "./nav_tree.js";
import { routeFromUrl, type ShellRoute } from "./routes.js";
import type { EmbeddedShellEnvironment } from "./store_host.js";
import { openDisclosures, type ShellState } from "./store_state.js";

export interface PendingNavigation {
  fragment?: string;
  navigation?: FrameNavigation;
  selection: ViewerSelection;
}

export function hostRoute(
  catalogue: Catalogue,
  selection: ViewerSelection,
  fragment?: string,
): ShellRoute {
  const entry = selection.screenId
    ? catalogue.byId.get(selection.screenId)
    : undefined;
  const view =
    entry && entry.kind !== "collection"
      ? { kind: "target" as const, target: { kind: "entry" as const, entry } }
      : selection.screenId === null
        ? { kind: "home" as const }
        : { kind: "missing" as const, requested: selection.screenId };
  return {
    view,
    ...(fragment ? { fragment } : {}),
    ...(selection.variantId ? { variant: selection.variantId } : {}),
  };
}

export function withHostRoute(
  state: ShellState,
  route: ShellRoute,
  sections: readonly NavSectionNode[],
): ShellState {
  const path =
    route.view.kind === "target"
      ? disclosurePath(sections, route.view.target.entry.route)
      : [];
  return {
    ...state,
    announcement:
      route.view.kind === "target"
        ? `Loaded ${route.view.target.entry.title} · Mokly`
        : "Loaded Mokly",
    disclosures: openDisclosures(state.disclosures, path),
    drawerOpen: false,
    expandedFrame: undefined,
    filterBaseline: state.filterBaseline
      ? openDisclosures(state.filterBaseline, path)
      : undefined,
    route,
    tagPickerOpen: false,
  };
}

export function announceNavigation(
  environment: EmbeddedShellEnvironment,
  selection: ViewerSelection,
  fragment: string | undefined,
  pending: PendingNavigation | undefined,
): void {
  const entry = routedEntries(environment.model).find(
    (candidate) => candidate.id === selection.screenId,
  );
  if (!entry) return;
  const variantId =
    selection.variantId ??
    (entry.kind === "component" ? entry.variants[0]?.id : undefined);
  environment.events().onScreenNavigate?.({
    screenId: entry.id,
    route: entry.route,
    ...(variantId ? { variantId } : {}),
    ...(fragment ? { fragment } : {}),
    ...(pending?.navigation ? { navigation: pending.navigation } : {}),
  });
}

export function hostClick(
  event: MouseEvent<HTMLElement>,
  catalogue: Catalogue,
  context: ShellContext,
  environment: EmbeddedShellEnvironment | undefined,
  request: (route: ShellRoute) => void,
  setState: Dispatch<SetStateAction<ShellState>>,
  state: ShellState,
): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (!target || !environment) return;
  closePickerFromTag(event.currentTarget, target, setState, state);
  if (target.closest("[data-mokly-tag-toggle], [data-mokly-tag-picker]"))
    return;
  if (target.closest("[data-mokly-slot]")) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || !eligibleAnchor(event, anchor)) return;
  const href = anchor.getAttribute("href");
  if (!href) return;
  const requested = routeFromUrl(catalogue, new URL(href, environment.baseUrl));
  const route = anchor.hasAttribute("data-nav-row")
    ? changesActivation(catalogue, context, state.selection, requested)
    : requested;
  if (route.view.kind === "missing") return;
  event.preventDefault();
  request(route);
}

function closePickerFromTag(
  root: HTMLElement,
  target: Element,
  setState: Dispatch<SetStateAction<ShellState>>,
  state: ShellState,
): void {
  if (
    !state.tagPickerOpen ||
    !target.closest("[data-mokly-tag]") ||
    target.closest("[data-mokly-tag-picker]")
  )
    return;
  setState((current) => ({ ...current, tagPickerOpen: false }));
  queueMicrotask(() =>
    root.querySelector<HTMLElement>("[data-mokly-tag-toggle]")?.focus(),
  );
}

export function hostKeyDown(
  event: KeyboardEvent<HTMLElement>,
  setState: Dispatch<SetStateAction<ShellState>>,
  state: ShellState,
): void {
  if (event.key !== "Escape") return;
  if (state.tagPickerOpen) {
    event.preventDefault();
    setState((current) => ({ ...current, tagPickerOpen: false }));
    event.currentTarget
      .querySelector<HTMLElement>("[data-mokly-tag-toggle]")
      ?.focus();
  } else if (state.expandedFrame) {
    event.preventDefault();
    setState((current) => ({ ...current, expandedFrame: undefined }));
  }
}

function eligibleAnchor(
  event: MouseEvent<HTMLElement>,
  anchor: HTMLAnchorElement,
): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !anchor.hasAttribute("download") &&
    (!anchor.target || anchor.target === "_self")
  );
}
