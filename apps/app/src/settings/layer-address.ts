import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import type { Resource } from "../data/use-resource";
import { replaceAddress } from "../navigation/address";
import { resolveHome } from "../navigation/destinations";
import { projectPath, settingsPath } from "../navigation/paths";
import type { SurfaceId } from "./panes";
import { paneQuery, paneRoute } from "./routes";
import { scopeSlugs } from "./scope";
import type { SettingsScope } from "./scope";

/**
 * Where a durable settings route belongs once its scope is known. On a compact
 * surface the route is the full-screen layer, so it moves to the pane's
 * canonical address; on a wide one it hands over to the dialog, over the
 * project the scope names, or else over the workspace's destination. The
 * route draws the dialog's wait until then, with its own ways out, so a
 * destination that is read hands over only while the route is still shown: a
 * reader who left meanwhile stays where they went.
 */
export function useLayerAddress({
  compact,
  requested,
  scope,
  signedIn,
  pathname,
  search,
}: {
  compact: boolean;
  requested: SurfaceId;
  scope: Resource<SettingsScope>;
  signedIn: boolean;
  pathname: string;
  search: string;
}): void {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  // The application renders one route at a time, so the route is shown
  // exactly while it is mounted.
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);

  useEffect(() => {
    if (!compact || scope.status !== "ready") return;
    // A pane that the scope gives no address, such as a project's pane whose
    // project the reader cannot open, lands on the settings index.
    const canonical =
      paneRoute(requested, scopeSlugs(scope.value)) ??
      settingsPath({ pane: "sections" });
    if (canonical !== pathname) replaceAddress(router, canonical + search);
  }, [compact, pathname, requested, router, scope, search]);

  useEffect(() => {
    if (compact || redirecting || !signedIn || scope.status !== "ready") {
      return;
    }
    setRedirecting(true);
    const resolvedProject = scope.value.project;
    if (resolvedProject) {
      replaceAddress(
        router,
        paneQuery(
          projectPath(resolvedProject.workspaceSlug, resolvedProject.slug),
          requested,
          search,
        ),
      );
      return;
    }
    resolveHome(scope.value.workspace)
      .then((destination) => {
        if (!shown.current) return;
        replaceAddress(router, paneQuery(destination.href, requested, search));
      })
      .catch(() => setRedirecting(false));
  }, [compact, redirecting, signedIn, requested, scope, router, search]);
}
