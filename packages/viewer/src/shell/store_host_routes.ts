/** Pure route projection and input handling for application-owned shell roots. */

import { resolveCatalogueSelection } from "../catalogue/entry_selection.js";
import type { FrameNavigation } from "../client/frame_adapter.js";
import type { ViewerSelection } from "../host/types.js";
import { eligibleAnchor } from "../navigation/activation.js";

import type { Catalogue } from "./catalogue.js";
import { changesActivation } from "./changes_activation.js";
import type { ShellContext } from "./context.js";
import type { NavSectionNode } from "./nav_tree.js";
import { routeFromUrl, type ShellRoute } from "./routes.js";
import {
  sameShellRoute,
  type ShellClickEvent,
} from "./store_browser_routes.js";
import type { EmbeddedShellEnvironment } from "./store_host.js";
import { installShellRoute } from "./store_routes.js";
import type { ShellState } from "./store_state.js";

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
  const entry = selection.screenPath
    ? resolveCatalogueSelection(
        catalogue.publicModel,
        selection.screenPath,
        selection.snapshotId,
      )?.entry
    : undefined;
  const view = entry
    ? { kind: "target" as const, target: { kind: "entry" as const, entry } }
    : selection.screenPath === null
      ? { kind: "home" as const }
      : { kind: "missing" as const, requested: selection.screenPath };
  return {
    view,
    ...(selection.snapshotId ? { snapshot: selection.snapshotId } : {}),
    ...(fragment ? { fragment } : {}),
  };
}

/** Whether committing a selection must reinstall its route-owned display. */
export function hostSelectionRouteChanged(
  catalogue: Catalogue,
  state: ShellState,
  selection: ViewerSelection,
  fragment = state.route.fragment,
): boolean {
  return !sameShellRoute(
    state.route,
    hostRoute(catalogue, selection, fragment),
  );
}

/** Apply an unavailable frame destination only when the Viewer owns selection. */
export function frameMissState(
  state: ShellState,
  route: ShellRoute,
  sections: readonly NavSectionNode[],
  controlled: boolean,
  catalogue: Catalogue,
): ShellState {
  return controlled ? state : withHostRoute(state, route, sections, catalogue);
}

export function withHostRoute(
  state: ShellState,
  route: ShellRoute,
  sections: readonly NavSectionNode[],
  catalogue: Catalogue,
): ShellState {
  return installShellRoute(state, route, catalogue, sections, "embedded");
}

export function announceNavigation(
  environment: EmbeddedShellEnvironment,
  catalogue: Catalogue,
  selection: ViewerSelection,
  fragment: string | undefined,
  pending: PendingNavigation | undefined,
): void {
  const entry =
    typeof selection.screenPath === "string"
      ? resolveCatalogueSelection(
          catalogue.publicModel,
          selection.screenPath,
          selection.snapshotId,
        )?.entry
      : undefined;
  if (!entry) return;
  environment.events().onScreenNavigate?.({
    screenPath: entry.path,
    ...(selection.snapshotId ? { snapshotId: selection.snapshotId } : {}),
    ...(fragment ? { fragment } : {}),
    ...(pending?.navigation ? { navigation: pending.navigation } : {}),
  });
}

export function hostClick(
  event: ShellClickEvent,
  catalogue: Catalogue,
  context: ShellContext,
  environment: EmbeddedShellEnvironment | undefined,
  request: (route: ShellRoute) => void,
  state: ShellState,
): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (!target || !environment) return;
  if (target.closest("[data-mokly-tag-toggle], [data-mokly-tag-picker]"))
    return;
  if (target.closest("[data-mokly-slot]")) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || !eligibleAnchor(event, anchor)) return;
  const href = anchor.getAttribute("href");
  if (!href) return;
  const url = new URL(href, environment.baseUrl);
  if (!ownedCatalogueUrl(url, environment.baseUrl, anchor.ownerDocument))
    return;
  const requested = routeFromUrl(catalogue, url);
  const route = anchor.hasAttribute("data-nav-row")
    ? changesActivation(catalogue, context, state.selection, requested)
    : requested;
  event.preventDefault();
  if (route.view.kind === "missing") {
    environment.events().onError?.({
      code: "selection",
      message: "The requested catalogue selection is unavailable.",
    });
    return;
  }
  request(route);
}

function ownedCatalogueUrl(
  url: URL,
  baseUrl: URL,
  ownerDocument: Document,
): boolean {
  return (
    (url.origin === baseUrl.origin ||
      url.origin === ownerDocument.location.origin) &&
    url.hash === "" &&
    (url.pathname === "/" || url.pathname.startsWith("/view/"))
  );
}
