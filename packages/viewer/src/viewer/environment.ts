/** Explicit browser boundaries for application-owned shell roots. */

import type { ComparisonEnvironment } from "../shell/comparison_context.js";
import type { ScrollTogetherPreference } from "../shell/comparison_scroll_preference.js";
import type { EmbeddedShellEnvironment } from "../shell/store_host.js";

import type { LoadedCatalogue } from "./source.js";
import type { ViewerEvents, ViewerSelection } from "./types.js";

/** Bind public viewer data to shell selection and navigation behavior. */
export function viewerShellEnvironment(
  loaded: LoadedCatalogue,
  selection: ViewerSelection,
  controlled: boolean,
  events: () => ViewerEvents,
  onNavigation: () => void,
): EmbeddedShellEnvironment {
  return {
    baseUrl: loaded.url,
    controlled,
    events,
    model: loaded.catalogue,
    onNavigation,
    open(url, target, features) {
      return typeof window === "undefined"
        ? null
        : window.open(url, target, features);
    },
    selection,
  };
}

/**
 * Keep embedded comparisons pinned to the catalogue that declared them. The
 * Scroll together choice belongs to the mounted viewer, not to one source, so
 * the caller supplies the one it keeps above source replacement.
 */
export function viewerComparisonEnvironment(
  loaded: LoadedCatalogue,
  reportError?: (error: unknown) => void,
  scrollTogether?: ScrollTogetherPreference,
): ComparisonEnvironment {
  return {
    baseUrl: loaded.url,
    delivery: () => ({
      kind: "pinned",
      comparisonUrl: loaded.catalogue.comparisonUrl,
    }),
    fetch: (input, init) => fetch(input, init),
    ...(reportError ? { reportError } : {}),
    ...(scrollTogether ? { scrollTogether } : {}),
  };
}
