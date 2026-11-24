/** Shell actions shared by standalone history and application-owned hosts. */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { ViewerSelection } from "../host/types.js";
import { viewHref } from "../navigation/routes.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import {
  disclosureStorageKey,
  encodeDisclosureMap,
} from "./disclosure_storage.js";
import { toggledFilter } from "./frames_filter.js";
import { NARROW_SHELL } from "./layout_breakpoint.js";
import { navigationFiltering } from "./nav_model.js";
import {
  folderRevealPath,
  folderRevealProposal,
  folderRevealSelection,
} from "./nav_reveal.js";
import type { NavSectionNode } from "./nav_tree.js";
import { clearTagTerm, parseSearchQuery, setTagTerm } from "./search_query.js";
import type { ShellBrowserActions } from "./store_browser.js";
import type { ShellStore } from "./store_context.js";
import { withFilterSelection } from "./store_filters.js";
import { openDisclosures, type ShellState } from "./store_state.js";

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
    openEntry(path, axes) {
      // A host's selection names the entry and the axes in one proposal.
      if (input.embedded) {
        input.propose({ ...axes, screenPath: path });
        return;
      }
      updateSelection(axes);
      input.navigation.navigateFrame(viewHref(path));
    },
    persistNavigationWidth(value = input.stateRef.current.navigationWidth) {
      if (value === undefined || input.embedded) return;
      const current = input.stateRef.current;
      const width = Math.round(
        Math.max(192, Math.min(current.navigationMaximum, value)),
      );
      persist(widthStorageKey, String(width));
    },
    resetNavigationWidth() {
      if (!input.embedded) forget(widthStorageKey);
      input.setState((current) => ({ ...current, navigationWidth: undefined }));
    },
    revealFolder(section, path) {
      const reveal = folderRevealPath(input.sections, section, path);
      if (!reveal) return;
      if (input.embedded) {
        const before = input.stateRef.current.selection;
        const proposal = folderRevealProposal(
          before,
          folderRevealSelection(reveal.node, before, input.context),
        );
        if (proposal) input.propose(proposal.selection, proposal.rawQuery);
      }
      const sheet = catalogueSheetShown();
      input.setState((current) => {
        const selection = input.embedded
          ? current.selection
          : folderRevealSelection(
              reveal.node,
              current.selection,
              input.context,
            );
        const filtered =
          selection === current.selection
            ? current
            : withFilterSelection(current, selection);
        const disclosures = openDisclosures(filtered.disclosures, reveal.keys);
        persistDisclosures(filtered.selection, disclosures, !input.embedded);
        return {
          ...filtered,
          ...(sheet && filtered.sheet !== "catalogue"
            ? { sheet: "catalogue" as const, sheetExpanded: false }
            : {}),
          disclosures,
          filterBaseline:
            filtered.filterBaseline &&
            openDisclosures(filtered.filterBaseline, reveal.keys),
          revealedFolder: {
            key: reveal.keys.at(-1) ?? "",
            selection: filtered.selection,
          },
        };
      });
    },
    select: updateSelection,
    selectColorScheme(value) {
      updateSelection({
        colorScheme: input.catalogue.hasDarkFragments ? value : "light",
      });
    },
    setDisclosure(key, open) {
      input.setState((current) => {
        const disclosures = { ...current.disclosures, [key]: open };
        persistDisclosures(current.selection, disclosures, !input.embedded);
        return { ...current, disclosures };
      });
    },
    toggleFrame(name, checked) {
      const { frames, selection } = input.stateRef.current;
      const next = toggledFilter(frames, selection.viewport, name, checked);
      if (next.viewport !== selection.viewport)
        updateSelection({ viewport: next.viewport });
      if (
        next.schemes.dark !== frames.dark ||
        next.schemes.light !== frames.light
      )
        input.setState((current) => ({ ...current, frames: next.schemes }));
    },
    setPanelTab(panelTab) {
      input.setState((current) =>
        current.panelTab === panelTab ? current : { ...current, panelTab },
      );
    },
    setNavigationMaximum(value) {
      input.setState((current) => ({
        ...current,
        navigationMaximum: value,
        navigationWidth:
          current.navigationWidth === undefined
            ? undefined
            : Math.min(current.navigationWidth, value),
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
    setSheet(sheet) {
      input.setState((current) =>
        current.sheet === sheet
          ? current
          : { ...current, sheet, sheetExpanded: false },
      );
    },
    setSheetExpanded(expanded) {
      input.setState((current) => ({ ...current, sheetExpanded: expanded }));
    },
    setTagPicker(open, index = input.stateRef.current.tagPickerIndex) {
      input.setState((current) => ({
        ...current,
        tagPickerIndex: index,
        tagPickerOpen: open,
      }));
    },
    settleComparisonIntent(installation) {
      input.setState((current) =>
        current.comparisonIntent && current.routeInstallation === installation
          ? { ...current, comparisonIntent: false }
          : current,
      );
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

/** Persist the disclosure map a standalone shell adopted, unless filtering. */
export function persistDisclosures(
  selection: ViewerSelection,
  disclosures: Readonly<Record<string, boolean>>,
  standalone: boolean,
): void {
  if (standalone && !navigationFiltering(selection)) {
    try {
      localStorage.setItem(
        disclosureStorageKey,
        encodeDisclosureMap(disclosures),
      );
    } catch {
      return;
    }
  }
}

/** Whether the catalogue is a sheet of the compact layout at the current width. */
function catalogueSheetShown(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia(NARROW_SHELL).matches
  );
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

function forget(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}
