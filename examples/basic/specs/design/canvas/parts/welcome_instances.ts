import { COMPONENTS } from "../../components/parts/metadata.js";

import { CANVAS_PAGES, type CanvasDestination } from "./destinations.js";

/** The registered instances that the example's Welcome renders. */
export type WelcomeInstanceId = "details" | "toolbar" | "primary" | "secondary";

/** A box in the sketch's CSS pixels, from the frame's top-left corner. */
interface SketchBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One instance of the depicted Welcome, as its instance record holds it. */
export interface WelcomeInstance {
  id: WelcomeInstanceId;
  /** The title of the instance's component. */
  component: string;
  /** The instance that renders it; none for the screen's own instances. */
  parent?: WelcomeInstanceId | undefined;
  /** The props that the screen or the parent supplies, each value as code. */
  props: readonly { name: string; value: string }[];
  /** Its box on the Mobile · Light frame, where the reader selects it. */
  box: SketchBox;
  padding: { top: number; right: number; bottom: number; left: number };
  /** The component's source file. */
  source: string;
  /** The artboard that shows the instance selected. */
  page: CanvasDestination;
  /** The Canvas artboard that opens the instance's component, if any. */
  componentPage?: CanvasDestination | undefined;
}

/**
 * Welcome's instances in the order of its instance records: its own Action
 * and Toolbar, and the Toolbar's two Actions. Each box is the instance's box
 * in the phone sketch, which `design-shots.css` lays out in fixed rows: the
 * Action keeps a fixed width, the Toolbar spans the content, and the
 * Toolbar's Actions, stacked in a phone, take the width of their labels in
 * Geist.
 */
export const WELCOME_INSTANCES: Readonly<
  Record<WelcomeInstanceId, WelcomeInstance>
> = {
  details: {
    id: "details",
    component: "Action",
    props: [
      { name: "label", value: '"View details"' },
      { name: "tone", value: '"primary"' },
      { name: "destination", value: '"details"' },
    ],
    box: { x: 20, y: 95.75, width: 112, height: 30 },
    padding: { top: 0, right: 10, bottom: 0, left: 10 },
    source: COMPONENTS.action.source,
    page: CANVAS_PAGES.selection,
    componentPage: CANVAS_PAGES.componentSet,
  },
  toolbar: {
    id: "toolbar",
    component: "Toolbar",
    props: [{ name: "title", value: '"Workspace actions"' }],
    box: { x: 20, y: 167.75, width: 350, height: 128 },
    padding: { top: 10, right: 12, bottom: 10, left: 12 },
    source: COMPONENTS.toolbar.source,
    page: CANVAS_PAGES.selectionToolbar,
  },
  primary: {
    id: "primary",
    component: "Action",
    parent: "toolbar",
    props: [
      { name: "label", value: '"Browse details"' },
      { name: "tone", value: '"primary"' },
      { name: "destination", value: '"details"' },
    ],
    box: { x: 33, y: 225.5, width: 107.03, height: 26 },
    padding: { top: 0, right: 10, bottom: 0, left: 10 },
    source: COMPONENTS.action.source,
    page: CANVAS_PAGES.selectionPrimary,
    componentPage: CANVAS_PAGES.componentSet,
  },
  secondary: {
    id: "secondary",
    component: "Action",
    parent: "toolbar",
    props: [
      { name: "label", value: '"Browse welcome"' },
      { name: "tone", value: '"secondary"' },
      { name: "destination", value: '"welcome"' },
    ],
    box: { x: 33, y: 257.5, width: 119.56, height: 26 },
    padding: { top: 0, right: 10, bottom: 0, left: 10 },
    source: COMPONENTS.action.source,
    page: CANVAS_PAGES.selectionSecondary,
    componentPage: CANVAS_PAGES.componentSet,
  },
};

/** The size that the selection and Inspect show, in whole pixels. */
export function instanceSize(instance: WelcomeInstance) {
  return {
    width: Math.round(instance.box.width),
    height: Math.round(instance.box.height),
  };
}

/** The content box inside the padding, as the box model names it. */
export function contentSize(instance: WelcomeInstance) {
  const { box, padding } = instance;
  return {
    width: Math.round(box.width - padding.left - padding.right),
    height: Math.round(box.height - padding.top - padding.bottom),
  };
}

/** The frame that the reader selects on, as Inspect names it. */
export const SELECTION_FRAME = {
  id: "mobile-light",
  label: "Mobile · Light",
} as const;
