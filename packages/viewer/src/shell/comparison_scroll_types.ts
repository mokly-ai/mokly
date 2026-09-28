/** The contract between a comparison section's panes and its scroll controller. */

import type { FrameScheduler } from "../previews/presented_document.js";

import type { ComparisonSide, ScrollOwner } from "./comparison_scroll_owner.js";

/** The elements of one layer: its version, viewport, surface and frame. */
export interface ComparisonLayerElements {
  /** The device-sized, never user-scrolled frame showing one version. */
  frame: HTMLIFrameElement;
  /** Which version the frame shows. */
  side: ComparisonSide;
  /** The opaque surface shown wherever the version's document has ended. */
  surface: HTMLElement;
  /** The shared viewport, the only user-scrollable container of the layer. */
  viewport: HTMLElement;
}

/** The scroll owner of one comparison section's viewports and layers. */
export interface ComparisonScrollSync {
  /** Track a layer until the returned function releases it. */
  attachLayer(layer: ComparisonLayerElements): () => void;
  /** Mirror a viewport whose spacer extends its range to the tallest version. */
  attachViewport(viewport: HTMLElement, spacer: HTMLElement): () => void;
  /** Reveal a same-document anchor target inside one frame. */
  reveal(frame: HTMLIFrameElement, target: Element): void;
  /** Turn Scroll together on or off for the open comparison, at once. */
  setTogether(on: boolean): void;
}

/** Observes element sizes on behalf of the controller. */
export interface SizeObserver {
  observe(target: Element, options?: ResizeObserverOptions): void;
  unobserve(target: Element): void;
}

/** Browser observation and scheduling the controller depends on. */
export interface ComparisonScrollEnvironment extends FrameScheduler {
  observeSizes(changed: () => void): SizeObserver;
}

/** How one section's controller starts. */
export interface ComparisonScrollOptions {
  /** Observation and scheduling; the browser's by default. */
  environment?: ComparisonScrollEnvironment;
  /** The comparison's last-scrolled version, shared by all its sections. */
  owner?: ScrollOwner;
  /** Whether Scroll together starts on; it does by default. */
  together?: boolean;
}
