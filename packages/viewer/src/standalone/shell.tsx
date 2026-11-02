/** The standalone Browse shell: index loading, the shell store and its chrome. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { RootState, ShellLayout } from "@mokly/ui/shell-layout";

import { deploymentCheck } from "../catalogue/sources.js";
import type { CatalogueReadModel } from "../catalogue/types.js";
import { MoklyVersionError } from "../catalogue/version_error.js";
import type { ComparisonEnvironment } from "../shell/comparison_context.js";
import { storedScrollTogether } from "../shell/comparison_scroll_preference.js";
import { useFocusAfter } from "../shell/focus_after.js";
import { CatalogueNav } from "../shell/nav.js";
import { useNavigationBounds } from "../shell/nav_resize.js";
import { useShellRoot } from "../shell/root_context.js";
import { routeFromUrl } from "../shell/routes.js";
import { ShellStoreProvider } from "../shell/store.js";
import { persistDisclosures } from "../shell/store_actions.js";
import { useShellStore } from "../shell/store_context.js";
import { useShellBindings } from "../shell/store_interactions.js";
import type { ShellInitialState } from "../shell/store_state.js";
import { TopBar } from "../shell/top_bar.js";
import { ShellMain } from "../shell/views.js";

import {
  fetchStandaloneIndex,
  standaloneDataSource,
  type StandaloneWindow,
} from "./data_source.js";
import type { EffectiveAppearance } from "./startup.js";
import {
  useStandaloneAppearance,
  type StandaloneAppearance,
} from "./use_appearance.js";
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
  initialAppearance = {
    theme: "auto",
    scheme: preferences.colorScheme ?? "light",
  },
}: {
  preferences: ShellInitialState;
  win: ShellWindow;
  initialAppearance?: EffectiveAppearance;
}) {
  const appearance = useStandaloneAppearance(win, initialAppearance);
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
  const root = { kind: "standalone", theme: appearance.theme } as const;
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
      appearance={appearance}
      index={state.index}
      onVersionError={(error) => setState({ kind: "version", error })}
      preferences={preferences}
      win={win}
    />
  );
}

function ReadyShell({
  appearance,
  index,
  onVersionError,
  preferences,
  win,
}: {
  appearance: StandaloneAppearance;
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
      initialState={{ ...preferences, colorScheme: appearance.scheme }}
      onAppearanceRoute={appearance.applyRoute}
      interactive
      onVersionError={onVersionError}
      route={(catalogue) => routeFromUrl(catalogue, new URL(win.location.href))}
      source={source}
    >
      <StandaloneShellContents appearance={appearance} />
    </ShellStoreProvider>
  );
}

/** The standalone chrome: the top bar, navigation, the main region and status. */
export function StandaloneShellContents({
  appearance: supplied,
}: {
  appearance?: StandaloneAppearance;
}) {
  const store = useShellStore();
  const appearance = supplied ?? {
    ready: false,
    theme: store.context.theme ?? "auto",
    scheme: store.state.selection.colorScheme,
  };
  const shellRoot = useShellRoot();
  const localShell = useRef<HTMLDivElement>(null);
  const shell = shellRoot?.elements.root ?? localShell;
  useNavigationBounds(shell);
  useShellBindings(shell, store);
  useLayoutEffect(() => {
    store.selectColorScheme(appearance.scheme);
  }, [appearance.scheme]);
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
      frameExpanded={Boolean(store.state.expandedFrame)}
      resizing={shellRoot?.resizing}
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
      ref={shellRoot?.ref ?? shell}
      statusId="mb-status"
      theme={appearance.theme}
      topBar={<TopBar appearance={appearance} catalogue={store.catalogue} />}
    />
  );
}
