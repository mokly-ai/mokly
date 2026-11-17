import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { Workspace, Project, Session } from "../api/types";

import type { SurfaceId } from "./panes";

/** Everything a pane needs about the surface it is hosted on. */
export interface SettingsContextValue {
  session: Session;
  workspaces: readonly Workspace[];
  workspace?: Workspace;
  project?: Project;
  /** A nested edit within the active pane, including the surface heading. */
  paneView?: {
    id: "slug";
    pane: "workspace" | "project";
    title: string;
  };
  reload: () => void;
  /** Replace the routed subject after a canonical rename and refresh scope. */
  replaceRoute: (href: string) => void;
  /** Open or close a nested edit without creating another settings pane. */
  openPaneView: (view: {
    id: "slug";
    pane: "workspace" | "project";
    title: string;
  }) => void;
  closePaneView: () => void;
  close: () => void;
  /**
   * Leave settings for somewhere else in the product. Every way out asks the
   * same question, so a control inside a pane cannot take the reader past the
   * draft they are holding.
   */
  leaveTo: (href: string) => void;
  /**
   * Leave settings by doing something rather than going somewhere — signing
   * out, say. Unsaved work is asked about first, exactly as it is for a
   * destination, and forgotten once the reader says to go on.
   */
  leaveBy: (go: () => void) => void;
  /**
   * Leave settings after something the reader has already confirmed by name
   * and cannot undo. That confirmation is their answer, so nothing is asked
   * again — a second question could only offer a choice the product can no
   * longer honour — and what was unsaved is forgotten on the way out rather
   * than left behind for a later pane to present as current.
   */
  leaveConfirmed: (href: string) => void;
  /** A pane's address, or nothing where the scope gives the pane none. */
  href: (pane: SurfaceId) => string | undefined;
  /**
   * Reach another pane. The dialog replaces its entry, because settings is one
   * entry over the page beneath and one press of Back has to close it; the
   * full-screen layer pushes, because there each pane is its own screen and
   * Back means the index the reader came from.
   */
  goToPane: (pane: SurfaceId) => void;
}

const Context = createContext<SettingsContextValue | undefined>(undefined);

/** Give the hosted panes their scope, without telling them which frame hosts them. */
export function SettingsProvider({
  value,
  children,
}: {
  value: SettingsContextValue;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The scope the hosting route resolved for this pane. */
export function useSettings(): SettingsContextValue {
  const value = useContext(Context);
  if (!value) {
    throw new Error("[app/settings] useSettings used outside SettingsProvider");
  }
  return value;
}
