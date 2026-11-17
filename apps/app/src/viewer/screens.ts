import type { Screen } from "../api/types";
import type { PagedItems } from "../data/publications";
import type { Resource } from "../data/use-resource";
import type { ViewerScheme, ViewerSelection } from "./host";

/**
 * One screen that a share link can open from the reader's view, with the
 * scheme of the view that the link opens.
 */
export interface ShareableScreen extends Pick<Screen, "path" | "title"> {
  scheme: ViewerScheme;
}

/**
 * The listed screens that Share offers from the reader's view, in list order.
 *
 * A link pins the screen and the way it is drawn together, so a screen joins
 * only when this publication draws it at the reader's viewport, or at either
 * published viewport for Both, which the Share API leaves out. Under Dark the
 * pinned viewer shows a screen that has no dark view through its light view,
 * so that screen still joins, and its link opens the light view. The list and
 * the selected screen both come from here, so they cannot disagree.
 */
export function shareableScreens(
  screens: readonly Screen[],
  selection: ViewerSelection,
): ShareableScreen[] {
  const drawn = (screen: Screen, scheme: ViewerScheme) =>
    screen.views.some(
      (view) =>
        (selection.viewport === "both" ||
          view.viewport === selection.viewport) &&
        view.colorScheme === scheme,
    );
  return screens.flatMap((screen): ShareableScreen[] => {
    const scheme = drawn(screen, selection.scheme)
      ? selection.scheme
      : selection.scheme === "dark" && drawn(screen, "light")
        ? "light"
        : undefined;
    return scheme === undefined
      ? []
      : [{ path: screen.path, title: screen.title, scheme }];
  });
}

/**
 * The selected package entry when the cloud Share API can represent it, with
 * the scheme of the view that its link opens.
 *
 * `listScreens` is deliberately a Share capability, not a catalogue-membership
 * oracle. Components, pages and use cases are valid package entries but are
 * absent from this response. Only a loaded screen that the Share list offers
 * can enter `getShareLink`. A capped list's absent screen remains unknown;
 * neither kind of absence rewrites controlled viewer state.
 */
export function shareableScreen(
  state: Resource<PagedItems<Screen>>,
  enabled: boolean,
  selection: ViewerSelection,
): ShareableScreen | undefined {
  if (!enabled || state.status !== "ready" || selection.screen === undefined) {
    return undefined;
  }
  return shareableScreens(state.value.items, selection).find(
    ({ path }) => path === selection.screen,
  );
}
