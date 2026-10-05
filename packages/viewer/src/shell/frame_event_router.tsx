/** Root-scoped navigation for authenticated events from visible frame sessions. */

import { useEffect, useRef } from "react";

import type { FrameNavigation } from "../client/frame_adapter.js";
import { viewHref } from "../navigation/routes.js";

import type { Catalogue } from "./catalogue.js";
import { useOptionalShellFrameRegistry } from "./frame_registry.js";
import { useShellStore } from "./store_context.js";

/** Route frame navigation without scanning or mutating another shell root. */
export function ShellFrameEventRouter() {
  const registry = useOptionalShellFrameRegistry();
  const store = useShellStore();
  const latest = useRef(store);
  latest.current = store;
  useEffect(() => {
    if (!registry) return;
    return registry.subscribeEvents((session, event) => {
      if (
        event.type !== "navigation" ||
        !registry.inspection.visibleSessions().includes(session)
      )
        return;
      routeNavigation(latest.current, event.navigation);
    });
  }, [registry]);
  return null;
}

function routeNavigation(
  store: ReturnType<typeof useShellStore>,
  navigation: FrameNavigation,
): void {
  const href = frameNavigationHref(store.catalogue, navigation);
  if (!store.catalogue.byPath.has(navigation.screenPath)) {
    store.navigateFrame(href, navigation);
    return;
  }
  const target = navigation.target;
  if (
    target.kind === "blank" ||
    target.kind === "named" ||
    (target.kind === "self" && navigation.activation !== "primary")
  ) {
    store.openFrame(href, target.kind === "named" ? target.name : "_blank");
  } else store.navigateFrame(href, navigation);
}

/** Resolve one logical frame destination without consulting delivery aliases. */
export function frameNavigationHref(
  catalogue: Catalogue,
  navigation: FrameNavigation,
): string {
  const entry = catalogue.byPath.get(navigation.screenPath);
  const pathname = entry
    ? viewHref(entry.path)
    : viewHref(navigation.screenPath);
  const url = new URL(pathname, "https://mokly.invalid");
  if (navigation.fragment)
    url.searchParams.set("fragment", navigation.fragment);
  return `${url.pathname}${url.search}`;
}
