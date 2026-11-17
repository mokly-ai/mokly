import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { PaneError } from "../components/resource-state";
import { useCompact } from "../layout/viewport";
import {
  replaceAddress,
  useAddressPathname,
  useAddressSearch,
} from "../navigation/address";
import { signInHref } from "../navigation/destinations";
import { dashboardPath } from "../navigation/paths";
import { useSession } from "../session/context";

import { useBackGuard } from "./back-guard";
import { SettingsProvider } from "./context";
import { useDirtyState } from "./dirty";
import { DiscardConfirmation } from "./discard";
import { useLayerAddress } from "./layer-address";
import { PaneView, paneTitle } from "./pane-view";
import { availablePanes, resolvePane } from "./panes";
import type { SurfaceId } from "./panes";
import { SettingsRouteWait } from "./route-wait";
import { paneRoute } from "./routes";
import { scopeSlugs, useSettingsScope } from "./scope";
import { ScopeWait, scopePanes } from "./scope-wait";
import { SettingsLayer } from "./surface";

/**
 * How the reader asked to leave: a back gesture the browser is already making,
 * or an on-screen affordance that names where it goes.
 */
type Exit =
  | { kind: "gesture" }
  | { kind: "go"; href: string; replace: boolean }
  | { kind: "do"; go: () => void };

/**
 * The durable settings routes. On a compact surface they are the full-screen
 * layer; on a wide one they redirect onto the page the reader would be on with
 * the dialog open, so one link works everywhere. Both draw the requested
 * pane's wait from the session read on.
 */
export function SettingsRoute({
  pane: requested,
  workspaceId,
  projectId,
  workspaceSlug,
  projectSlug,
}: {
  pane: SurfaceId;
  workspaceId?: string;
  projectId?: string;
  workspaceSlug?: string;
  projectSlug?: string;
}) {
  const router = useRouter();
  const compact = useCompact();
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const { state } = useSession();
  const drafts = useDirtyState();
  const [confirming, setConfirming] = useState<Exit | undefined>(undefined);
  const [paneView, setPaneView] = useState<
    | {
        id: "slug";
        pane: "workspace" | "project";
        title: string;
      }
    | undefined
  >(undefined);
  const asking = useRef(false);
  asking.current = confirming !== undefined;
  // The settings index names no project, so it resolves the reader's own one;
  // every other route already carries the scope it manages.
  const scope = useSettingsScope({
    workspaceId,
    projectId,
    workspaceSlug,
    projectSlug,
    resolveProject: requested === "sections",
    enabled: state.status === "signed-in",
  });
  const reloadScope = scope.reload;

  useEffect(() => {
    if (state.status !== "signed-out") return;
    replaceAddress(router, signInHref(pathname + search));
  }, [pathname, router, search, state.status]);

  useLayerAddress({
    compact,
    requested,
    scope: scope.state,
    signedIn: state.status === "signed-in",
    pathname,
    search,
  });

  const gesture = useBackGuard({
    armed: compact,
    drafts,
    isAsking: () => asking.current,
    onBlocked: () => setConfirming({ kind: "gesture" }),
  });

  // A deliberate exit is never interrogated again, and a gesture is finished by
  // letting the gesture itself through, so the device's back button lands where
  // the browser was already going rather than somewhere this screen chose.
  const leave = useCallback(
    (exit: Exit) => {
      drafts.clear();
      setConfirming(undefined);
      if (exit.kind === "gesture") {
        gesture.release();
        return;
      }
      if (exit.kind === "do") {
        exit.go();
        return;
      }
      if (exit.replace) router.replace(exit.href);
      else router.push(exit.href);
    },
    [gesture, drafts, router],
  );

  /** Every way out of a pane asks the same question first. */
  const ask = useCallback(
    (exit: Exit) => {
      if (drafts.isDirty()) {
        setConfirming(exit);
        return;
      }
      leave(exit);
    },
    [drafts, leave],
  );

  const guard = useCallback(
    (target: string) => ask({ kind: "go", href: target, replace: true }),
    [ask],
  );
  const close = useCallback(() => guard(dashboardPath), [guard]);
  const leaveTo = useCallback(
    (href: string) => ask({ kind: "go", href, replace: false }),
    [ask],
  );
  const leaveBy = useCallback(
    (go: () => void) => ask({ kind: "do", go }),
    [ask],
  );
  const leaveConfirmed = useCallback(
    (href: string) => leave({ kind: "go", href, replace: true }),
    [leave],
  );
  const replaceRoute = useCallback(
    (href: string) => {
      router.replace(href);
      reloadScope();
    },
    [reloadScope, router],
  );

  if (state.status === "signed-out") return null;
  const session = state.status === "signed-in" ? state.session : undefined;
  const discard = confirming && (
    <DiscardConfirmation
      onDiscard={() => leave(confirming)}
      onCancel={() => setConfirming(undefined)}
    />
  );
  if (!compact) {
    if (state.status === "error") return null;
    // Until the route has handed over to the dialog, it draws that dialog's
    // wait, whose rail leads to each pane's own route.
    return (
      <SettingsRouteWait
        pane={requested}
        session={session}
        slugs={{ workspaceSlug, projectSlug }}
        scope={scope.state}
        onRetry={scope.reload}
        onRoute={(href) => router.replace(href)}
        onClose={close}
        discard={discard}
      />
    );
  }
  if (state.status === "error") {
    return (
      <SettingsLayer
        pane="sections"
        title="Settings"
        back={{ label: "Close", href: dashboardPath }}
      >
        <PaneError
          title="Settings couldn’t load"
          error={state.error}
          onRetry={() => router.replace("/settings")}
        />
      </SettingsLayer>
    );
  }

  // While the session and then the scope load, the layer draws the requested
  // pane's wait, and its bar keeps the way back that the pane will have.
  const scoped = scope.state.status === "ready" ? scope.state.value : undefined;
  const available = scoped
    ? availablePanes({
        workspace: Boolean(scoped.workspace),
        project: Boolean(scoped.project),
        role: scoped.workspace?.role,
      })
    : scopePanes(
        requested === "sections" ||
          Boolean(projectId || (workspaceSlug && projectSlug)),
      );
  const pane =
    requested === "sections" ? "sections" : resolvePane(requested, available);
  const nestedView = scoped && paneView?.pane === pane ? paneView : undefined;
  const slugs = scopeSlugs(scoped);
  const href = (target: SurfaceId) => paneRoute(target, slugs);
  // Each pane is its own screen here, so reaching one is a step the reader can
  // take back to the index they came from. A pane the scope gives no address
  // is not one to reach.
  const goToPane = (target: SurfaceId) => {
    const address = href(target);
    if (address === undefined) return;
    setPaneView(undefined);
    router.push(address);
  };
  // A nested view's way back is its pane, which this route draws.
  const back = nestedView
    ? {
        label: paneTitle(pane),
        href: href(pane) ?? pathname,
        onPress: () => setPaneView(undefined),
      }
    : pane === "sections"
      ? { label: "Close", href: dashboardPath }
      : { label: "Settings", href: "/settings" };
  return (
    <SettingsLayer
      pane={pane}
      title={nestedView?.title ?? paneTitle(pane)}
      back={{
        ...back,
        onPress: back.onPress ?? (() => guard(back.href)),
      }}
    >
      {session === undefined || scope.state.status === "loading" ? (
        <ScopeWait pane={pane} panes={available} session={session} />
      ) : scope.state.status === "error" ? (
        <PaneError
          title="Settings couldn’t load"
          error={scope.state.error}
          onRetry={scope.reload}
        />
      ) : (
        <SettingsProvider
          value={{
            session,
            workspaces: scope.state.value.workspaces,
            workspace: scope.state.value.workspace,
            project: scope.state.value.project,
            paneView: nestedView,
            reload: reloadScope,
            replaceRoute,
            openPaneView: setPaneView,
            closePaneView: () => setPaneView(undefined),
            close,
            leaveTo,
            leaveBy,
            leaveConfirmed,
            href,
            goToPane,
          }}
        >
          {discard}
          <PaneView pane={pane} />
        </SettingsProvider>
      )}
    </SettingsLayer>
  );
}
