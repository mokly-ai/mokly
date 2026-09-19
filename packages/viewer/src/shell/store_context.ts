/** React context boundary for one live Browse shell. */

import { createContext, useContext } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import type { FrameNavigation } from "../client/frame_adapter.js";
import type { ViewerSelection } from "../viewer/types.js";

import type { Catalogue } from "./catalogue.js";
import type { ShellContext } from "./context.js";
import type { NavSectionNode } from "./nav_tree.js";
import type { ShellState } from "./store_state.js";
import type { ShellRecoverySnapshot } from "./store_state.js";

/** State and actions consumed by shell-owned interactive components. */
export interface ShellStore {
  catalogue: Catalogue;
  context: ShellContext;
  interactive: boolean;
  sections: readonly NavSectionNode[];
  state: ShellState;
  collapseAll(): void;
  copy(text: string, announcement?: string): void;
  navigateFrame(href: string, navigation?: FrameNavigation): void;
  openFrame(href: string, target: string): void;
  persistNavigationWidth(value?: number): void;
  recoverySnapshot(): ShellRecoverySnapshot;
  select(selection: Partial<ViewerSelection>): void;
  selectColorScheme(value: "dark" | "light"): void;
  selectVariant(value: string): void;
  selectViewport(value: "both" | "desktop" | "mobile"): void;
  setDetails(open: boolean, tab?: string): void;
  setDisclosure(key: string, open: boolean): void;
  setDrawer(open: boolean): void;
  setExpandedFrame(key: string | undefined): void;
  setNavigationWidth(value: number): void;
  setNavigationMaximum(value: number): void;
  setNavScroll(value: number): void;
  setSearch(value: string): void;
  setTagPicker(open: boolean, index?: number): void;
  setView(value: "all" | "changes"): void;
  toggleTag(tag: string): void;
  onShellClick(event: MouseEvent<HTMLElement>): void;
  onShellKeyDown(event: KeyboardEvent<HTMLElement>): void;
}

const ShellStoreContext = createContext<ShellStore | undefined>(undefined);

/** Provider primitive kept separate so standalone composition stays small. */
export const ShellStoreBoundary = ShellStoreContext.Provider;

/** Read the live store when a shell is mounted under standalone React. */
export function useOptionalShellStore(): ShellStore | undefined {
  return useContext(ShellStoreContext);
}

/** Require the live store from a standalone-only bridge. */
export function useShellStore(): ShellStore {
  const store = useOptionalShellStore();
  if (!store) throw new Error("The hydrated shell store is unavailable.");
  return store;
}
