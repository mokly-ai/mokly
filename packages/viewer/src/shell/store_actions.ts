/** Shell actions shared by standalone history and application-owned hosts. */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import { navigationFiltering } from "./nav_model.js";
import type { NavSectionNode } from "./nav_tree.js";
import { clearTagTerm, parseSearchQuery, setTagTerm } from "./search_query.js";
import type { ShellBrowserActions } from "./store_browser.js";
import type { ShellStore } from "./store_context.js";
import { withFilterSelection } from "./store_filters.js";
import { captureScrolls } from "./store_scroll.js";
import { closedDisclosures, type ShellState } from "./store_state.js";

const navStorageKey = "mokly:nav-disclosure:v2";
const detailsStorageKey = "mokly:details-disclosure";
const widthStorageKey = "mokly:navigation-width:v1";

interface StoreActionsInput {
  catalogue: Catalogue;
  context: ShellContext;
  embedded: boolean;
  interactive: boolean;
  navigation: ShellBrowserActions;
  propose(selection: Partial<ViewerSelection>, rawQuery?: string): void;
  sections: readonly NavSectionNode[];
  setState: Dispatch<SetStateAction<ShellState>>;
  state: ShellState;
  stateRef: MutableRefObject<ShellState>;
}

/** Construct the store value without obscuring provider lifecycle hooks. */
export function shellStore(input: StoreActionsInput): ShellStore {
  const updateSelection = (
    partial: Partial<ViewerSelection>,
    rawQuery?: string,
  ) => {
    if (input.embedded) {
      input.propose(partial, rawQuery);
      return;
    }
    input.setState((current) => {
      const next = withFilterSelection(current, {
        ...current.selection,
        ...partial,
      });
      return rawQuery === undefined ? next : { ...next, query: rawQuery };
    });
  };
  return {
    catalogue: input.catalogue,
    context: input.context,
    interactive: input.interactive,
    sections: input.sections,
    state: input.state,
    ...input.navigation,
    collapseAll() {
      input.setState((current) => {
        const disclosures = Object.fromEntries(
          Object.keys(current.disclosures).map((key) => [key, false]),
        );
        persistDisclosures(current.selection, disclosures, !input.embedded);
        return { ...current, disclosures };
      });
    },
    copy(text, announcement) {
      copyText(text);
      if (announcement)
        input.setState((current) => ({ ...current, announcement }));
    },
    persistNavigationWidth(value = input.stateRef.current.navigationWidth) {
      const current = input.stateRef.current;
      const width = Math.round(
        Math.max(192, Math.min(current.navigationMaximum, value)),
      );
      if (!input.embedded) persist(widthStorageKey, String(width));
    },
    recoverySnapshot() {
      return shellRecoverySnapshot(
        input.stateRef.current,
        input.interactive && !input.embedded,
      );
    },
    select: updateSelection,
    selectColorScheme(value) {
      updateSelection({
        colorScheme: input.catalogue.hasDarkFragments ? value : "light",
      });
    },
    selectViewport(value) {
      updateSelection({ viewport: value });
    },
    setDetails(open, tab = "details") {
      if (!input.embedded) persist(detailsStorageKey, open ? "open" : "closed");
      input.setState((current) => ({
        ...current,
        detailsOpen: open,
        inspectorTab: open ? tab : undefined,
      }));
    },
    setDisclosure(key, open) {
      input.setState((current) => {
        const disclosures = { ...current.disclosures, [key]: open };
        persistDisclosures(current.selection, disclosures, !input.embedded);
        return { ...current, disclosures };
      });
    },
    setDrawer(open) {
      input.setState((current) => ({ ...current, drawerOpen: open }));
    },
    setExpandedFrame(key) {
      input.setState((current) => ({ ...current, expandedFrame: key }));
    },
    setNavigationMaximum(value) {
      input.setState((current) => ({
        ...current,
        navigationMaximum: value,
        navigationWidth: Math.min(current.navigationWidth, value),
      }));
    },
    setNavigationWidth(value) {
      input.setState((current) => ({
        ...current,
        navigationWidth: Math.round(
          Math.max(192, Math.min(current.navigationMaximum, value)),
        ),
      }));
    },
    setNavScroll(value) {
      input.setState((current) => ({ ...current, navScroll: value }));
    },
    setSearch(value) {
      const query = parseSearchQuery(value);
      updateSelection({ search: query.freeText, tags: query.tags }, value);
    },
    setTagPicker(open, index = input.stateRef.current.tagPickerIndex) {
      input.setState((current) => ({
        ...current,
        tagPickerIndex: index,
        tagPickerOpen: open,
      }));
    },
    setView(value) {
      updateSelection({ view: value });
    },
    toggleTag(tag) {
      const current = input.stateRef.current;
      const selected = current.selection.tags.includes(tag.toLowerCase());
      const nextQuery = selected
        ? clearTagTerm(current.query, tag)
        : setTagTerm(current.query, tag);
      const query = parseSearchQuery(nextQuery);
      updateSelection({ search: query.freeText, tags: query.tags }, nextQuery);
      input.setState((state) => ({ ...state, tagPickerOpen: false }));
    },
  };
}

/** Capture reload state without assuming that this shell owns the document. */
export function shellRecoverySnapshot(
  state: ShellState,
  interactive: boolean,
): ReturnType<ShellStore["recoverySnapshot"]> {
  const regionScrolls =
    interactive && typeof document !== "undefined"
      ? captureScrolls(document)
      : state.regionScrolls;
  return {
    ...(state.changesStatus ? { changesStatus: state.changesStatus } : {}),
    closedFolderKeys: closedDisclosures(state.disclosures),
    colorScheme: state.selection.colorScheme,
    detailsOpen: state.detailsOpen,
    drawerOpen: state.drawerOpen,
    filterBaselineClosedFolderKeys: state.filterBaseline
      ? closedDisclosures(state.filterBaseline)
      : null,
    navScroll: state.navScroll,
    query: state.query,
    regionScrolls,
    view: state.selection.view,
    viewport: state.selection.viewport,
  };
}

function persistDisclosures(
  selection: ViewerSelection,
  disclosures: Readonly<Record<string, boolean>>,
  standalone: boolean,
): void {
  if (standalone && !navigationFiltering(selection))
    persist(navStorageKey, JSON.stringify(closedDisclosures(disclosures)));
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
