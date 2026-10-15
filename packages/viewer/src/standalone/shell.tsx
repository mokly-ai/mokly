/** The standalone Browse shell: index loading, the shell store and its chrome. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { CatalogueReadModel } from "../catalogue/types.js";
import { MoklyVersionError } from "../catalogue/version_error.js";
import type { ComparisonEnvironment } from "../shell/comparison_context.js";
import { storedScrollTogether } from "../shell/comparison_scroll_preference.js";
import { CatalogueNav } from "../shell/nav.js";
import { useNavigationBounds } from "../shell/nav_resize.js";
import { routeFromUrl } from "../shell/routes.js";
import { ShellStoreProvider } from "../shell/store.js";
import { persistDisclosures } from "../shell/store_actions.js";
import { useShellStore, type ShellStore } from "../shell/store_context.js";
import type { ShellInitialState } from "../shell/store_state.js";
import { TopBar } from "../shell/top_bar.js";
import { ShellMain } from "../shell/views.js";

import { useStandaloneAppearance } from "./appearance_bridge.js";
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
  if (state.kind === "version") return <VersionFailure error={state.error} />;
  if (state.kind === "failed")
    return (
      <div className="mbk mbk-empty" role="alert">
        <h2>The catalogue could not be loaded</h2>
        <button
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((value) => value + 1);
          }}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  if (state.kind === "loading")
    return (
      <div className="mbk mbk-empty" role="status">
        Loading catalogue…
      </div>
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
  const [source] = useState(() => standaloneDataSource(win));
  const comparison = useMemo<ComparisonEnvironment>(
    () => ({
      baseUrl: win.location.origin,
      delivery: () =>
        index.live
          ? { kind: "live" }
          : { kind: "pinned", comparisonUrl: index.comparisonUrl },
      fetch: (input, init) => win.fetch(input, init),
      initialMode: () =>
        new URL(win.location.href).searchParams.get("comparison") === "side"
          ? "side"
          : undefined,
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
  const { selection, disclosures } = store.state;
  useEffect(
    () => persistDisclosures(selection, disclosures, true),
    [disclosures, selection],
  );
  return (
    <div
      className="mbk"
      data-drawer={store.state.drawerOpen ? "open" : "closed"}
      data-mokly-shell=""
      ref={shell}
    >
      <a className="mbk-skip-link" href="#mb-main">
        Skip to content
      </a>
      <TopBar appearance={appearance} catalogue={store.catalogue} />
      <div className="mbk-body">
        <CatalogueNav catalogue={store.catalogue} context={store.context} />
        <ShellMain
          catalogue={store.catalogue}
          context={store.context}
          view={store.state.route.view}
        />
      </div>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="mbk-route-status"
        id="mb-status"
        role="status"
      >
        {store.state.announcement}
      </p>
    </div>
  );
}

/**
 * The stub owns the document body: the shell marks it full-screen and
 * expanded, and handles clicks and Escape that reach it, including the
 * expanded frame's backdrop.
 */
function useBodyBindings(store: ShellStore): void {
  const latest = useRef(store);
  latest.current = store;
  useEffect(() => {
    const body = document.body;
    body.classList.add("mbk-fs");
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
  const expanded = Boolean(store.state.expandedFrame);
  useLayoutEffect(() => {
    document.body.classList.toggle("frame-expanded", expanded);
  }, [expanded]);
}
