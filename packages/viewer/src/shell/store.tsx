/** Shell-scoped React state for standalone Browse hydration. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { DisplaySelection } from "../viewer/display_context.js";
import { selectionQuery } from "../viewer/selection.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { catalogueNavSections, navigationFiltering } from "./nav_model.js";
import { parseSearchQuery } from "./search_query.js";
import { clearTagTerm, setTagTerm } from "./search_query.js";
import { useShellBrowser } from "./store_browser.js";
import { ShellStoreBoundary, type ShellStore } from "./store_context.js";
import { withFilterSelection } from "./store_filters.js";
import { createInitialShellState } from "./store_initial.js";
import { closedDisclosures } from "./store_state.js";
import type {
  ShellInitialState,
  ShellRecoverySnapshot,
} from "./store_state.js";
import type { ShellView } from "./views.js";

const navStorageKey = "mokly:nav-disclosure:v2";
const detailsStorageKey = "mokly:details-disclosure";
const widthStorageKey = "mokly:navigation-width:v1";

/** Provide one state owner to the complete standalone shell tree. */
export function ShellStoreProvider({
  catalogue,
  children,
  context,
  initialState,
  interactive,
  view,
}: {
  catalogue: Catalogue;
  children: ReactNode;
  context: ShellContext;
  initialState?: ShellInitialState;
  interactive: boolean;
  view: ShellView;
}) {
  const sections = useMemo(() => catalogueNavSections(catalogue), [catalogue]);
  const [state, setState] = useState(() =>
    createInitialShellState(catalogue, context, view, initialState),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const browser = useShellBrowser({
    catalogue,
    context,
    interactive,
    sections,
    setState,
    state,
  });
  const runtimeContext = useMemo(
    () => currentContext(context, state),
    [context, state.changesStatus, state.route],
  );

  useEffect(() => {
    if (!interactive) return;
    const resize = () =>
      setState((current) => {
        const maximum = Math.max(
          192,
          Math.min(480, Math.floor(window.innerWidth / 2)),
        );
        return {
          ...current,
          navigationMaximum: maximum,
          navigationWidth: Math.min(current.navigationWidth, maximum),
        };
      });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [interactive]);

  const store: ShellStore = {
    catalogue,
    context: runtimeContext,
    interactive,
    sections,
    state,
    ...browser,
    collapseAll() {
      setState((current) => {
        const disclosures = Object.fromEntries(
          Object.keys(current.disclosures).map((key) => [key, false]),
        );
        if (!navigationFiltering(current.selection))
          persist(
            navStorageKey,
            JSON.stringify(closedDisclosures(disclosures)),
          );
        return { ...current, disclosures };
      });
    },
    copy(text, announcement) {
      copyText(text);
      if (announcement) setState((current) => ({ ...current, announcement }));
    },
    persistNavigationWidth(value = stateRef.current.navigationWidth) {
      const width = Math.round(
        Math.max(192, Math.min(stateRef.current.navigationMaximum, value)),
      );
      persist(widthStorageKey, String(width));
    },
    recoverySnapshot() {
      return recoverySnapshot(stateRef.current);
    },
    selectColorScheme(value) {
      setState((current) => ({
        ...current,
        selection: {
          ...current.selection,
          colorScheme: catalogue.hasDarkFragments ? value : "light",
        },
      }));
    },
    selectViewport(value) {
      setState((current) => ({
        ...current,
        selection: { ...current.selection, viewport: value },
      }));
    },
    setDetails(open, tab = "details") {
      persist(detailsStorageKey, open ? "open" : "closed");
      setState((current) => ({
        ...current,
        detailsOpen: open,
        inspectorTab: open ? tab : undefined,
      }));
    },
    setDisclosure(key, open) {
      setState((current) => {
        const disclosures = { ...current.disclosures, [key]: open };
        if (!navigationFiltering(current.selection))
          persist(
            navStorageKey,
            JSON.stringify(closedDisclosures(disclosures)),
          );
        return { ...current, disclosures };
      });
    },
    setDrawer(open) {
      setState((current) => ({ ...current, drawerOpen: open }));
    },
    setExpandedFrame(key) {
      setState((current) => ({ ...current, expandedFrame: key }));
    },
    setNavigationWidth(value) {
      setState((current) => ({
        ...current,
        navigationWidth: Math.round(
          Math.max(192, Math.min(current.navigationMaximum, value)),
        ),
      }));
    },
    setNavScroll(value) {
      setState((current) => ({ ...current, navScroll: value }));
    },
    setSearch(value) {
      const query = parseSearchQuery(value);
      setState((current) =>
        withFilterSelection(current, {
          ...current.selection,
          search: query.freeText,
          tags: query.tags,
        }),
      );
    },
    setTagPicker(open, index = stateRef.current.tagPickerIndex) {
      setState((current) => ({
        ...current,
        tagPickerIndex: index,
        tagPickerOpen: open,
      }));
    },
    setView(value) {
      setState((current) =>
        withFilterSelection(current, { ...current.selection, view: value }),
      );
    },
    toggleTag(tag) {
      setState((current) => {
        const raw = selectionQuery(current.selection);
        const selected = current.selection.tags.includes(tag.toLowerCase());
        const query = parseSearchQuery(
          selected ? clearTagTerm(raw, tag) : setTagTerm(raw, tag),
        );
        return {
          ...withFilterSelection(current, {
            ...current.selection,
            search: query.freeText,
            tags: query.tags,
          }),
          tagPickerOpen: false,
        };
      });
    },
  };
  return (
    <ShellStoreBoundary value={store}>
      <DisplaySelection.Provider value={state.selection}>
        {children}
      </DisplaySelection.Provider>
    </ShellStoreBoundary>
  );
}

function currentContext(context: ShellContext, state: ShellStore["state"]) {
  const {
    activeRoute: _activeRoute,
    changesStatus: _changesStatus,
    fragment: _fragment,
    ...stable
  } = context;
  const activeRoute =
    state.route.view.kind === "target"
      ? state.route.view.target.entry.route
      : undefined;
  return {
    ...stable,
    ...(activeRoute ? { activeRoute } : {}),
    ...(state.changesStatus ? { changesStatus: state.changesStatus } : {}),
    ...(state.route.fragment ? { fragment: state.route.fragment } : {}),
  };
}

function recoverySnapshot(state: ShellStore["state"]): ShellRecoverySnapshot {
  return {
    ...(state.changesStatus ? { changesStatus: state.changesStatus } : {}),
    closedCollectionIds: closedDisclosures(state.disclosures),
    colorScheme: state.selection.colorScheme,
    detailsOpen: state.detailsOpen,
    drawerOpen: state.drawerOpen,
    filterBaselineClosedCollectionIds: state.filterBaseline
      ? closedDisclosures(state.filterBaseline)
      : null,
    navScroll: state.navScroll,
    query: selectionQuery(state.selection),
    regionScrolls: state.regionScrolls,
    view: state.selection.view,
    viewport: state.selection.viewport,
  };
}

function copyText(text: string): void {
  const clipboard = navigator.clipboard;
  if (clipboard) {
    void clipboard.writeText(text).catch(() => undefined);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}
