import { useGlobalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { PaneError } from "../components/resource-state";
import { useCompact } from "../layout/viewport";
import {
  replaceAddress,
  useAddressPathname,
  useAddressSearch,
  undoAddress,
  writeAddress,
} from "../navigation/address";
import { settingsPath } from "../navigation/paths";
import { readQuery } from "../navigation/query";
import { useSession } from "../session/context";

import { useBackGuard } from "./back-guard";
import { SettingsProvider } from "./context";
import { useDirtyState } from "./dirty";
import { DiscardConfirmation } from "./discard";
import { PaneView, paneTitle } from "./pane-view";
import { availablePanes, resolvePane } from "./panes";
import type { SurfaceId } from "./panes";
import {
  pageBeneath,
  paneQuery,
  paneRoute,
  queryWithoutSettings,
} from "./routes";
import { scopeSlugs, useSettingsScope } from "./scope";
import { ScopeWait, scopePanes } from "./scope-wait";
import { SettingsDialog } from "./surface";

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * How the reader asked to leave. A gesture is finished by letting the gesture
 * itself through, so back lands where the browser was already going; every
 * other exit names its own destination.
 */
type Exit =
  | { kind: "gesture" }
  | { kind: "go"; href: string; replace: boolean }
  | { kind: "do"; go: () => void };

/**
 * The desktop dialog over whatever product page the reader is on. It is
 * addressed by `?settings=`, so opening it never navigates the page beneath and
 * closing it returns to that page unchanged. Below the breakpoint the same
 * address lands on the durable route instead, which is where the compact
 * surface draws the pane.
 */
export function SettingsDialogHost() {
  const router = useRouter();
  const pathname = useAddressPathname();
  const params = useGlobalSearchParams();
  const compact = useCompact();
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
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  // Opening, switching and closing the dialog change only the query of the
  // page it is drawn over, so the application writes them rather than routing
  // them; `src/navigation/address.ts` says why that is not the router's to do.
  // The page beneath keeps its own query keys while the dialog is over it.
  const search = useAddressSearch();
  const requested = single(readQuery(search).settings);
  const projectId = single(params.settingsProject) ?? single(params.projectId);
  const workspaceId = single(params.workspaceId);
  const workspaceSlug = single(params.workspace);
  const projectSlug = single(params.project);
  const open = requested !== undefined;
  const scope = useSettingsScope({
    workspaceId,
    projectId,
    workspaceSlug,
    projectSlug,
    enabled: open && state.status === "signed-in",
  });
  const reloadScope = scope.reload;

  // The dialog is drawn from the session read on. A reader whose session
  // answers signed out, or fails, is the page beneath's to send on.
  const drawn =
    open &&
    !compact &&
    (state.status === "loading" || state.status === "signed-in");
  const guard = useBackGuard({
    armed: drawn,
    drafts,
    isAsking: () => asking.current,
    onBlocked: () => setConfirming({ kind: "gesture" }),
  });

  // A deliberate exit is never interrogated again: the guard is told the
  // surface is on its way out before anything reaches the history stack.
  const leave = useCallback(
    (exit: Exit) => {
      drafts.clear();
      setConfirming(undefined);
      if (exit.kind === "gesture") {
        guard.release();
        return;
      }
      // The page beneath the dialog is the address the dialog is drawn over,
      // named rather than inferred from the stack: undoing the step that
      // opened it lands wherever the reader happened to come from, which for
      // a reader who came from a settings address is settings again.
      if (exit.kind === "do") {
        exit.go();
        return;
      }
      // The dialog only ever moves within the page it is drawn over, so its
      // exits are address writes; a pane's own destination outside settings
      // goes through `leaveTo`, which is routed. Closing undoes the entry the
      // trigger pushed, exactly as a viewer panel does, so one press of Back
      // leaves the page rather than retracing a step that does nothing.
      if (exit.replace && exit.href === pageBeneath(pathname, search)) {
        if (undoAddress()) return;
      }
      writeAddress(exit.href, exit.replace);
    },
    [drafts, guard, pathname, search],
  );

  // The answer is asked for, not remembered: a keystroke and the Escape that
  // follows it can land in the same frame.
  /** Every way out of the dialog asks the same question first. */
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

  const close = useCallback(
    () =>
      ask({ kind: "go", href: pageBeneath(pathname, search), replace: true }),
    [ask, pathname, search],
  );
  const leaveTo = useCallback(
    (href: string) => ask({ kind: "do", go: () => router.push(href) }),
    [ask, router],
  );
  const leaveBy = useCallback(
    (go: () => void) => ask({ kind: "do", go }),
    [ask],
  );
  const leaveConfirmed = useCallback(
    (href: string) => leave({ kind: "do", go: () => router.replace(href) }),
    [leave, router],
  );
  const replaceRoute = useCallback(
    (href: string) => {
      router.replace(href);
      reloadScope();
    },
    [reloadScope, router],
  );

  const href = useCallback(
    (pane: SurfaceId) => paneQuery(pathname, pane, search),
    [pathname, search],
  );
  // The dialog is one history entry over the page beneath, so reaching another
  // pane replaces it and one press of Back still closes settings.
  const goToPane = useCallback(
    (pane: SurfaceId) => {
      setPaneView(undefined);
      writeAddress(href(pane), true);
    },
    [href],
  );

  useEffect(() => setPaneView(undefined), [requested]);

  const scopeState = scope.state;

  // Below the breakpoint the pane is a full-screen route, so the query form
  // hands over to it rather than rendering nothing.
  useEffect(() => {
    if (!open || !compact || scopeState.status !== "ready") return;
    const pane = resolvePane(
      requested,
      availablePanes({
        workspace: Boolean(scopeState.value.workspace),
        project: Boolean(scopeState.value.project),
        role: scopeState.value.workspace?.role,
      }),
    );
    // The pane is one that the scope gives, so it has an address; the index
    // stands in for one without, as the full-screen layer's own redirect does.
    const route =
      paneRoute(pane, scopeSlugs(scopeState.value)) ??
      settingsPath({ pane: "sections" });
    const rest = queryWithoutSettings(search);
    replaceAddress(router, rest.length > 0 ? `${route}?${rest}` : route);
  }, [open, compact, scopeState, requested, router, search]);

  if (!drawn) return null;
  const session = state.status === "signed-in" ? state.session : undefined;

  // While the session and then the scope load, the rail draws the sections
  // that the address's scope gives an owner, and the pane draws the requested
  // pane's wait. The dialog stays mounted when each answer arrives, so nothing
  // it holds moves.
  const scoped = scopeState.status === "ready" ? scopeState.value : undefined;
  const available = scoped
    ? availablePanes({
        workspace: Boolean(scoped.workspace),
        project: Boolean(scoped.project),
        role: scoped.workspace?.role,
      })
    : scopeState.status === "loading"
      ? scopePanes(Boolean(projectId || (workspaceSlug && projectSlug)))
      : availablePanes({ workspace: false, project: false, role: undefined });
  const pane =
    scopeState.status === "error"
      ? "sections"
      : resolvePane(requested, available);
  const nestedView = scoped && paneView?.pane === pane ? paneView : undefined;
  const title =
    scopeState.status === "error"
      ? "Settings"
      : (nestedView?.title ?? paneTitle(pane));
  return (
    <SettingsDialog
      pane={pane}
      title={title}
      available={available}
      href={href}
      goToPane={goToPane}
      onClose={close}
      activeRef={activeRef}
    >
      {session === undefined || scopeState.status === "loading" ? (
        <ScopeWait pane={pane} panes={available} session={session} />
      ) : scopeState.status === "error" ? (
        <PaneError
          title="Settings couldn’t load"
          error={scopeState.error}
          onRetry={scope.reload}
        />
      ) : (
        <SettingsProvider
          value={{
            session,
            workspaces: scopeState.value.workspaces,
            workspace: scopeState.value.workspace,
            project: scopeState.value.project,
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
          {confirming && (
            <DiscardConfirmation
              onDiscard={() => leave(confirming)}
              onCancel={() => setConfirming(undefined)}
            />
          )}
          <PaneView pane={pane} />
        </SettingsProvider>
      )}
    </SettingsDialog>
  );
}
