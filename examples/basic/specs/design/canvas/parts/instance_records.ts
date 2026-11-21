import { COMPONENT_IDENTITIES } from "./component_identity.js";
import { CANVAS_PAGES } from "./destinations.js";
import {
  ACTION_PADDING,
  MOBILE_LIGHT,
  SKETCH_BORDER,
  TOOLBAR_PADDING,
  actionProps,
  toolbarAction,
  type InstanceRecords,
  type SelectionFrame,
} from "./instances.js";

/*
 * The instance records of each depicted entry, in the order of its records.
 * Each box is the instance's box in the sketch of the frame where the reader
 * selects it: a screen's phone sketch, which `design-shots.css` lays out in
 * fixed rows, or the Toolbar's component document. The Action keeps a fixed
 * width, the Toolbar spans the content, and the Toolbar's Actions, stacked
 * in a phone and side by side in a component document, take the width of
 * their labels in Geist.
 */

/** The two components that the depicted entries render. */
const { action: ACTION, toolbar: TOOLBAR } = COMPONENT_IDENTITIES;

/** The registered instances that the example's Welcome renders. */
export type WelcomeInstanceId = "details" | "toolbar" | "primary" | "secondary";

/**
 * Welcome's own Action and Toolbar, and the Toolbar's two Actions, below the
 * revised Welcome's one-line introduction.
 */
export const WELCOME_INSTANCES: InstanceRecords<WelcomeInstanceId> = {
  details: {
    id: "details",
    component: ACTION.title,
    props: actionProps("View details", "primary", "details"),
    frame: MOBILE_LIGHT,
    box: { x: 20, y: 127.125, width: 112, height: 30 },
    border: SKETCH_BORDER,
    padding: ACTION_PADDING,
    source: ACTION.source,
    page: CANVAS_PAGES.selection,
    componentPage: CANVAS_PAGES.componentSet,
  },
  toolbar: {
    id: "toolbar",
    component: TOOLBAR.title,
    props: [{ name: "title", value: '"Workspace actions"' }],
    frame: MOBILE_LIGHT,
    box: { x: 20, y: 199.125, width: 350, height: 128 },
    border: SKETCH_BORDER,
    padding: TOOLBAR_PADDING,
    source: TOOLBAR.source,
    page: CANVAS_PAGES.selectionToolbar,
    componentPage: CANVAS_PAGES.componentSetToolbar,
  },
  primary: toolbarAction(
    "primary",
    { x: 33, y: 256.875 },
    {
      frame: MOBILE_LIGHT,
      page: CANVAS_PAGES.selectionPrimary,
      parent: "toolbar",
    },
  ),
  secondary: toolbarAction(
    "secondary",
    { x: 33, y: 288.875 },
    {
      frame: MOBILE_LIGHT,
      page: CANVAS_PAGES.selectionSecondary,
      parent: "toolbar",
    },
  ),
};

/** The registered instances that the example's Details renders. */
export type DetailsInstanceId = "welcome" | "toolbar" | "primary" | "secondary";

/**
 * Details' own Action, which returns to Welcome, and its Toolbar, and the
 * Toolbar's two Actions, below Details' two-line text.
 */
export const DETAILS_INSTANCES: InstanceRecords<DetailsInstanceId> = {
  welcome: {
    id: "welcome",
    component: ACTION.title,
    props: actionProps("Return to welcome", "secondary", "welcome"),
    frame: MOBILE_LIGHT,
    box: { x: 20, y: 104.25, width: 148, height: 30 },
    border: SKETCH_BORDER,
    padding: ACTION_PADDING,
    source: ACTION.source,
    page: CANVAS_PAGES.addedWelcome,
    componentPage: CANVAS_PAGES.componentSet,
  },
  toolbar: {
    id: "toolbar",
    component: TOOLBAR.title,
    props: [{ name: "title", value: '"Catalogue actions"' }],
    frame: MOBILE_LIGHT,
    box: { x: 20, y: 176.25, width: 350, height: 128 },
    border: SKETCH_BORDER,
    padding: TOOLBAR_PADDING,
    source: TOOLBAR.source,
    page: CANVAS_PAGES.addedToolbar,
    componentPage: CANVAS_PAGES.componentSetToolbar,
  },
  primary: toolbarAction(
    "primary",
    { x: 33, y: 234 },
    { frame: MOBILE_LIGHT, page: CANVAS_PAGES.addedPrimary, parent: "toolbar" },
  ),
  secondary: toolbarAction(
    "secondary",
    { x: 33, y: 266 },
    {
      frame: MOBILE_LIGHT,
      page: CANVAS_PAGES.addedSecondary,
      parent: "toolbar",
    },
  ),
};

/** The Toolbar's frame of its saved variant Default in Light. */
const TOOLBAR_FRAME: SelectionFrame = {
  id: "default-light",
  label: "Default · Light",
};

/** The registered instances that the Toolbar renders itself. */
export type ToolbarInstanceId = "primary" | "secondary";

/**
 * The Toolbar's two Actions on its Default · Light frame, side by side, as
 * its nested components list them.
 */
export const TOOLBAR_INSTANCES: InstanceRecords<ToolbarInstanceId> = {
  primary: toolbarAction(
    "primary",
    { x: 37, y: 81.75 },
    { frame: TOOLBAR_FRAME, page: CANVAS_PAGES.componentSetPrimary },
  ),
  secondary: toolbarAction(
    "secondary",
    { x: 150.03, y: 81.75 },
    { frame: TOOLBAR_FRAME, page: CANVAS_PAGES.componentSetSecondary },
  ),
};
