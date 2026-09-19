/** Root-scoped navigation for authenticated events from visible frame sessions. */

import { useEffect, useRef } from "react";

import type { FrameNavigation } from "../client/frame_adapter.js";

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
  const href = navigationHref(navigation);
  const target = navigation.target;
  if (
    target.kind === "blank" ||
    target.kind === "named" ||
    (target.kind === "self" && navigation.activation !== "primary")
  ) {
    store.openFrame(href, target.kind === "named" ? target.name : "_blank");
  } else store.navigateFrame(href, navigation);
}

function navigationHref(navigation: FrameNavigation): string {
  const query = navigation.fragment
    ? `?fragment=${encodeURIComponent(navigation.fragment)}`
    : "";
  return `/id/${encodeURIComponent(navigation.id)}${query}`;
}
