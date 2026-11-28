import type { ReactNode } from "react";

import type { CatalogueReadModel, DetailSource } from "@mokly/viewer";

import type { FrameAccess } from "./access-exchange";
import type { CatalogueSource } from "./source-store";

/** Which of the package's two views the stage shows. */
export type ViewerView = "all" | "changes";

/** The catalogue viewport the package renders a screen at. */
export type ViewerViewport = "desktop" | "mobile" | "both";

/** The catalogue color scheme, independent of the app's own chrome theme. */
export type ViewerScheme = "light" | "dark";

/**
 * The package's interface appearance around its previews. The cloud always
 * names the app chrome's resolved scheme rather than the package's `auto`, so
 * the package chrome and the cloud controls in its slots never disagree.
 */
export type ViewerTheme = "light" | "dark";

/** A logical cloud control that can occupy fallback and package chrome. */
export type ViewerSlotName =
  "projects" | "switcher" | "history" | "share" | "account" | "more";

/** The typed form of the viewer's URL keys. */
export interface ViewerSelection {
  view: ViewerView;
  /** The catalogue entry: a screen, page, flow, component or variant path. */
  screen?: string;
  /**
   * The package's opaque 64-hex identity of the removed record `screen` names,
   * present only while the reader looks at that previous version.
   */
  snapshotId?: string;
  viewport: ViewerViewport;
  scheme: ViewerScheme;
  search: string;
  tags: readonly string[];
}

/**
 * The cloud chrome the package renders: the controls of its top bar, and the
 * Mokly check in its Changes tab. An absent slot draws nothing.
 */
export interface ViewerSlots {
  project?: ReactNode;
  publication?: ReactNode;
  history?: ReactNode;
  share?: ReactNode;
  /** The reader's avatar and the account menu it opens. */
  account?: ReactNode;
  /** The compact composition of project, history, share and the account. */
  more?: ReactNode;
  /**
   * The Mokly check of a pull request's publication with a comparison, which
   * the package's Changes tab shows after its change stepper. The cloud's own
   * bar draws no Changes tab, so it never draws the check.
   */
  check?: ReactNode;
}

/** What the stage shows; only `ready` mounts a catalogue. */
export type ViewerStatus = "ready" | "loading" | "unpublished" | "unavailable";

/** A catalogue whose index the host has read: what the package mounts. */
export interface HostedCatalogue {
  /** The publication origin and the credential policy of every read. */
  source: CatalogueSource;
  /** The catalogue index v9 copy the package is given as an object. */
  index: CatalogueReadModel;
  /** The host's own entry detail reads, one identity per source. */
  detail: DetailSource;
  /** The access callbacks of the private attempt that opened the catalogue. */
  frameAccess?: FrameAccess;
}

/**
 * The boundary between the cloud and `@mokly/viewer`. It is controlled: the
 * route owns the selection, the host renders the bar from the slots it is
 * given and the stage from the catalogue it has read, and reports every
 * change back.
 */
export interface ViewerHostProps {
  /** The read catalogue, present once the stage can mount it. */
  catalogue?: HostedCatalogue;
  /** The complete controlled selection the route read from the address. */
  selection: ViewerSelection;
  /** The package's proposal, which the route writes to the address. */
  onSelectionChange?: (next: ViewerSelection) => void;
  /** The app chrome's resolved scheme, which the package's interface takes. */
  theme: ViewerTheme;
  /** What the stage shows; only `ready` mounts a catalogue. */
  status: ViewerStatus;
  /** The in-stage card for every status other than `ready`. */
  stageMessage?: ReactNode;
  /**
   * The five cloud actions and More, which the bar composes into the
   * package's three top-bar slots.
   */
  slots?: ViewerSlots;
  /** Keep the fallback mounted while one of its slot activations concludes. */
  holdReady?: boolean;
}

/** The selection a route falls back to before any URL state is read. */
export const defaultSelection: ViewerSelection = {
  view: "all",
  viewport: "both",
  scheme: "light",
  search: "",
  tags: [],
};
