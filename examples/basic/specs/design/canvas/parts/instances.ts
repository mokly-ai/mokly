import { COMPONENT_IDENTITIES } from "./component_identity.js";
import { CANVAS_PAGES, type CanvasDestination } from "./destinations.js";

/** A box in the sketch's CSS pixels, from the frame's top-left corner. */
export interface SketchBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A length on each side of an instance's box: its border or its padding. */
interface SketchSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * An instance's measurements in the sketch: its outer box, which holds its
 * border, as the sketches size every box, and its border and its padding.
 */
export interface SketchMeasure {
  box: SketchBox;
  border: SketchSides;
  padding: SketchSides;
}

/** A frame of the stage, by its id, and its label as Inspect names it. */
export interface SelectionFrame {
  id: string;
  label: string;
}

/**
 * One registered instance of a depicted entry, as its instance record holds
 * it: its component, the instance that renders it, the props that its owner
 * supplies, the frame that the reader selects it on with its measurements
 * there, its component's source, the artboard that shows it selected, and
 * the Canvas artboard that opens its component.
 */
export interface CanvasInstance extends SketchMeasure {
  id: string;
  /** The title of the instance's component. */
  component: string;
  /** The instance that renders it; none for the entry's own instances. */
  parent?: string | undefined;
  /** The props that the entry or the parent supplies, each value as code. */
  props: readonly { name: string; value: string }[];
  frame: SelectionFrame;
  /** The component's source file. */
  source: string;
  /** The artboard that shows the instance selected. */
  page: CanvasDestination;
  /** The Canvas artboard that opens the instance's component, if any. */
  componentPage?: CanvasDestination | undefined;
}

/** The instances of one depicted entry, by id, in the order of its records. */
export type InstanceRecords<Id extends string> = Readonly<
  Record<Id, CanvasInstance>
>;

/** The phone frame of a screen, where a reader selects its instances. */
export const MOBILE_LIGHT: SelectionFrame = {
  id: "mobile-light",
  label: "Mobile · Light",
};

/**
 * The 1px border that a depicted Action and a depicted Toolbar draw on every
 * side, as `design-shots.css` draws them.
 */
export const SKETCH_BORDER = { top: 1, right: 1, bottom: 1, left: 1 };

/** A depicted Action keeps 10px beside its label. */
export const ACTION_PADDING = { top: 0, right: 10, bottom: 0, left: 10 };

/** A depicted Toolbar keeps 10px above and below, and 12px beside. */
export const TOOLBAR_PADDING = { top: 10, right: 12, bottom: 10, left: 12 };

/**
 * The real Action's button in a component document keeps 16px beside its
 * label, as the built document measures it.
 */
export const DOCUMENT_ACTION_PADDING = {
  top: 0,
  right: 16,
  bottom: 0,
  left: 16,
};

/**
 * The two Actions that the example's Toolbar renders, with the props that
 * it gives each and its outer width in a screen sketch: its label in Geist,
 * its padding, and its border.
 */
const TOOLBAR_ACTIONS = {
  primary: { label: "Browse details", destination: "details", width: 107.03 },
  secondary: { label: "Browse welcome", destination: "welcome", width: 119.56 },
} as const;

/** The props of a depicted Action, each value as code. */
export function actionProps(label: string, tone: string, destination: string) {
  return [
    { name: "label", value: `"${label}"` },
    { name: "tone", value: `"${tone}"` },
    { name: "destination", value: `"${destination}"` },
  ];
}

/**
 * One of the Toolbar's two Actions in a screen sketch, from the top-left
 * corner of its box on the frame where the reader selects it. Its chip opens
 * the Action's set.
 */
export function toolbarAction(
  id: keyof typeof TOOLBAR_ACTIONS,
  at: { x: number; y: number },
  record: Pick<CanvasInstance, "frame" | "page" | "parent">,
): CanvasInstance {
  const action = TOOLBAR_ACTIONS[id];
  return {
    id,
    component: COMPONENT_IDENTITIES.action.title,
    ...record,
    props: actionProps(action.label, id, action.destination),
    box: { ...at, width: action.width, height: 26 },
    border: SKETCH_BORDER,
    padding: ACTION_PADDING,
    source: COMPONENT_IDENTITIES.action.source,
    componentPage: CANVAS_PAGES.componentSet,
  };
}

/**
 * One of the Toolbar's two Actions in a component document of the Toolbar,
 * where the reader selects it: at its measured box, with the real button's
 * border and padding, which differ from a screen sketch's.
 */
export function documentToolbarAction(
  id: keyof typeof TOOLBAR_ACTIONS,
  measure: SketchMeasure,
  record: Pick<CanvasInstance, "frame" | "page">,
): CanvasInstance {
  return { ...toolbarAction(id, measure.box, record), ...measure };
}

/** The shell's label of an instance: its component's title and its id. */
export function instanceLabel(instance: CanvasInstance): string {
  return `${instance.component} · ${instance.id}`;
}

/** The size that the selection and Inspect show, in whole pixels. */
export function instanceSize(instance: CanvasInstance) {
  return {
    width: Math.round(instance.box.width),
    height: Math.round(instance.box.height),
  };
}

/**
 * The content box inside the border and the padding, in whole pixels, as the
 * box model names it.
 */
export function contentSize({ border, box, padding }: SketchMeasure) {
  return {
    width: Math.round(
      box.width - border.left - border.right - padding.left - padding.right,
    ),
    height: Math.round(
      box.height - border.top - border.bottom - padding.top - padding.bottom,
    ),
  };
}
