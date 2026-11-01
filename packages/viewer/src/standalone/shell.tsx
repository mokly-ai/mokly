/** The standalone Browse shell: index loading, the shell store and its chrome. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import type { EmptyStateRoot } from "@mokly/ui/empty-state";
import { RootState, ShellLayout } from "@mokly/ui/shell-layout";

import type { CatalogueReadModel } from "../catalogue/types.js";
import { MoklyVersionError } from "../catalogue/version_error.js";
import type { ComparisonEnvironment } from "../shell/comparison_context.js";
import { storedScrollTogether } from "../shell/comparison_scroll_preference.js";
import { useFocusAfter } from "../shell/focus_after.js";
import { CatalogueNav } from "../shell/nav.js";
import { useNavigationBounds } from "../shell/nav_resize.js";
import { routeFromUrl } from "../shell/routes.js";
import { ShellStoreProvider } from "../shell/store.js";
import { persistDisclosures } from "../shell/store_actions.js";
import { useShellStore, type ShellStore } from "../shell/store_context.js";
import type { ShellInitialState } from "../shell/store_state.js";
import { TopBar } from "../shell/top_bar.js";
import { ShellMain } from "../shell/views.js";
import { deploymentCheck } from "../viewer/sources.js";

import { useStandaloneAppearance } from "./appearance_bridge.js";
import { standaloneAppearanceHost } from "./appearance_host.js";
import {
  fetchStandaloneIndex,
  standaloneDataSource,
  type StandaloneWindow,
} from "./data_source.js";
import { VersionFailure } from "./version_failure.js";

type IndexState =
  | { kind: "loading" }
  | { kind: "ready"; index: CatalogueReadModel }
  | { kind: "failed" }
  | { kind: "version"; error: MoklyVersionError };

/** The browser surface of the standalone shell. */
export type ShellWindow = Window & typeof globalThis & StandaloneWindow;

/**
 * The root that the standalone shell's own states take the place of, in the
 * document's appearance. Only the ready shell's controls and routes change the
 * appearance, so a state reads it when it renders.
 */
function standaloneRoot(win: ShellWindow): EmptyStateRoot {
  const theme = standaloneAppearanceHost(win)?.current().theme ?? "auto";
  return { kind: "standalone", theme };
}

/** Fetch the index, then render the shell; a version failure replaces it. */
export function StandaloneShell({
  preferences,
  win,
}: {
  preferences: ShellInitialState;
  win: ShellWindow;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<IndexState>({ kind: "loading" });
  const focus = useFocusAfter<"loading">();
  useEffect(() => {
    const controller = new AbortController();
    void fetchStandaloneIndex(win, controller.signal).then(
      (index) => {
        if (!controller.signal.aborted) setState({ kind: "ready", index });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState(
          error instanceof MoklyVersionError
            ? { kind: "version", error }
            : { kind: "failed" },
        );
      },
    );
    return () => controller.abort();
  }, [attempt, win]);
  const root = standaloneRoot(win);
  if (state.kind === "version")
    return (
      <VersionFailure
        error={state.error}
        reload={() => win.location.reload()}
        root={root}
      />
    );
  if (state.kind === "failed")
    return (
      <RootState
        onRetry={() => {
          focus.request("loading");
          setState({ kind: "loading" });
          setAttempt((value) => value + 1);
        }}
        root={root}
        state="failed"
      />
    );
  if (state.kind === "loading")
    return (
      <RootState focusRef={focus.ref("loading")} root={root} state="loading" />
    );
  return (
    <ReadyShell
      index={state.index}
      onVersionError={(error) => setState({ kind: "version", error })}
      preferences={preferences}
      win={win}
    />
  );
}

function ReadyShell({
  index,
  onVersionError,
  preferences,
  win,
}: {
  index: CatalogueReadModel;
  onVersionError(error: MoklyVersionError): void;
  preferences: ShellInitialState;
  win: ShellWindow;
}) {
  const [source] = useState(() =>
    standaloneDataSource(win, index.live === undefined),
  );
  const comparison = useMemo<ComparisonEnvironment>(
    () => ({
      baseUrl: win.location.origin,
      delivery: () =>
        index.live
          ? { kind: "live" }
          : { kind: "pinned", comparisonUrl: index.comparisonUrl },
      fetch: (input, init) => win.fetch(input, init),
      ...(index.live === undefined
        ? {
            deploymentCheck: deploymentCheck(
              new URL("/", win.location.href),
              index.deploymentId,
              win.fetch,
              () => win.location.reload(),
            ),
          }
        : {}),
      scrollTogether: storedScrollTogether(() => win.localStorage),
    }),
    [index, win],
  );
  return (
    <ShellStoreProvider
      comparisonEnvironment={comparison}
      context={{ embedded: false }}
      index={index}
      initialState={preferences}
      interactive
      onVersionError={onVersionError}
      route={(catalogue) => routeFromUrl(catalogue, new URL(win.location.href))}
      source={source}
    >
      <StandaloneShellContents />
    </ShellStoreProvider>
  );
}

/** The standalone chrome: the top bar, navigation, the main region and status. */
export function StandaloneShellContents() {
  const store = useShellStore();
  const appearance = useStandaloneAppearance(store);
  const shell = useRef<HTMLDivElement>(null);
  useNavigationBounds(shell);
  useBodyBindings(store);
  useExpandedMark(shell, Boolean(store.state.expandedFrame));
  const { selection, disclosures } = store.state;
  useEffect(
    () => persistDisclosures(selection, disclosures, true),
    [disclosures, selection],
  );
  return (
    <ShellLayout
      announcement={store.state.announcement}
      colorScheme={appearance.scheme}
      drawerOpen={store.state.drawerOpen}
      main={
        <ShellMain
          catalogue={store.catalogue}
          context={store.context}
          view={store.state.route.view}
        />
      }
      mainHref="#mb-main"
      navigation={
        <CatalogueNav catalogue={store.catalogue} context={store.context} />
      }
      ref={shell}
      statusId="mb-status"
      theme={appearance.theme}
      topBar={<TopBar appearance={appearance} catalogue={store.catalogue} />}
    />
  );
}

/**
 * The stub owns the document body: the shell handles clicks and Escape that
 * reach it, including a click on the expanded frame's backdrop.
 */
function useBodyBindings(store: ShellStore): void {
  const latest = useRef(store);
  latest.current = store;
  useEffect(() => {
    const body = document.body;
    const click = (event: MouseEvent) => latest.current.onShellClick(event);
    const keydown = (event: KeyboardEvent) =>
      latest.current.onShellKeyDown(event);
    body.addEventListener("click", click);
    body.addEventListener("keydown", keydown);
    return () => {
      body.removeEventListener("click", click);
      body.removeEventListener("keydown", keydown);
    };
  }, []);
}

/**
 * Mark the shell root while a browser window is expanded, as an embedded root
 * is marked, so the root shows the scrim below the window.
 */
function useExpandedMark(
  root: RefObject<HTMLElement | null>,
  expanded: boolean,
): void {
  useLayoutEffect(() => {
    root.current?.classList.toggle("frame-expanded", expanded);
  }, [expanded, root]);
}
