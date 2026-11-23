import type { ReactNode } from "react";

import { defineScreen } from "@mokly/mokly";

import { artboardStates, type ArtboardVariant } from "../../parts/artboards.js";
import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import { MiniAction } from "../../parts/mini_action.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { COMPONENT_IDENTITIES } from "../parts/component_identity.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { componentFrames } from "../parts/frames.js";
import { ActionInspect, ToolbarInspect } from "../parts/inspect_sets.js";
import {
  TOOLBAR_INSTANCES,
  type ToolbarInstanceId,
} from "../parts/instance_records.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import {
  ACTION_DOCUMENT,
  TOOLBAR_VIEW,
  actionFrames,
  frameOf,
  toolbarFrames,
} from "../parts/set_sketches.js";
import { VariantSetArtboard } from "../parts/set_stage.js";
import { FITS } from "../parts/sketches.js";

/**
 * The zoom in percent that fits the Action's set: its own example's row and
 * the rows of its three saved variants, the largest zoom that keeps the set
 * at least 10px inside the stage.
 */
const ACTION_SET_FIT = 94;

/**
 * The Action's variant set: a row for its own example first, with the
 * component's own props and named by its title, as the shipped variant bar
 * names the parent's own entry, then one row for each saved variant, in
 * their order.
 */
function actionSetFrames() {
  return [
    ...componentFrames(
      [
        {
          slug: CANVAS_ENTRIES.action.slug,
          title: COMPONENT_IDENTITIES.action.title,
          render: () => <MiniAction variant="own" />,
        },
      ],
      ACTION_DOCUMENT,
    ),
    ...actionFrames(),
  ];
}

/**
 * The Action component opened as its variant set: its own example, then
 * Default, Disabled, and Secondary, each in Light and Dark, with Inspect for
 * a component. Once Disabled is chosen, its Light frame is selected and
 * Props edits it; on a phone, the frame picker shows that frame, under the
 * open Inspect sheet.
 */
function ActionSet({
  chosen,
  viewport,
}: {
  chosen: boolean;
  viewport: ArtboardViewport;
}) {
  const frames = actionSetFrames();
  const disabled = chosen ? frameOf(frames, "disabled-light") : undefined;
  const design = chosen
    ? CANVAS_PAGES.componentSetDisabled
    : CANVAS_PAGES.componentSet;
  return (
    <VariantSetArtboard
      catalogue={{ filter: "all", activeKey: COMPONENT_NAVIGATION.action.id }}
      design={design}
      entry={CANVAS_ENTRIES.action}
      frames={frames}
      panel={<ActionInspect disabled={disabled} />}
      selection={disabled === undefined ? undefined : { frame: disabled }}
      sheet={chosen ? "panel" : undefined}
      viewport={viewport}
      zoom={ACTION_SET_FIT}
    />
  );
}

/**
 * The Toolbar, a composed component, opened as its variant set: Default in
 * Light and Dark. With one of its Actions selected on the Default · Light
 * frame, Inspect opens at the Selection section; on a phone, the frame shows
 * the selection, and the pill above the dock names it.
 */
function ToolbarSet({
  selected,
  viewport,
}: {
  selected?: ToolbarInstanceId | undefined;
  viewport: ArtboardViewport;
}) {
  const instance =
    selected === undefined ? undefined : TOOLBAR_INSTANCES[selected];
  const design = instance?.page ?? CANVAS_PAGES.componentSetToolbar;
  return (
    <VariantSetArtboard
      catalogue={{ filter: "all", activeKey: COMPONENT_NAVIGATION.toolbar.id }}
      design={design}
      entry={CANVAS_ENTRIES.toolbar}
      frames={toolbarFrames()}
      panel={<ToolbarInspect design={design} selected={selected} />}
      selection={instance === undefined ? undefined : { instance }}
      view={TOOLBAR_VIEW}
      viewport={viewport}
      zoom={FITS.toolbar}
    />
  );
}

/** A saved state of the variant set, with its artboard in each viewport. */
function setState(
  slug: string,
  title: string,
  description: string,
  render: (viewport: ArtboardViewport) => ReactNode,
): ArtboardVariant {
  return {
    colorSchemes: canvasDesignMetadata.colorSchemes,
    description,
    desktop: render("desktop"),
    mobile: render("mobile"),
    slug,
    title,
  };
}

export const canvasComponentSetScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "A component opens as its variant set: a row for its own example, then one row per saved variant, Light beside Dark, inside a dashed outline. Inspect names the component, its own example and its variants, and its frames, and Props asks for a variant while no frame is selected.",
  ...artboardStates(
    {
      state: "action",
      title: "Action",
      desktop: <ActionSet chosen={false} viewport="desktop" />,
      mobile: <ActionSet chosen={false} viewport="mobile" />,
    },
    [
      setState(
        "disabled",
        "Variant chosen",
        "Disabled chosen in Variants: its Light frame is selected, with its corners and its size, and Props edits the Disabled variant. On a phone, the frame picker shows Disabled · Light, and the Inspect sheet is open at Props.",
        (viewport) => <ActionSet chosen viewport={viewport} />,
      ),
      setState(
        "toolbar",
        "Toolbar",
        "The Toolbar, a composed component, as its variant set: Default in Light and Dark. Inspect lists its consumers and its nested components, the two Actions that it renders.",
        (viewport) => <ToolbarSet viewport={viewport} />,
      ),
      setState(
        "toolbar-primary",
        "Toolbar's primary Action",
        "The Toolbar's first Action selected on the Default · Light frame, as its nested components select it.",
        (viewport) => <ToolbarSet selected="primary" viewport={viewport} />,
      ),
      setState(
        "toolbar-secondary",
        "Toolbar's secondary Action",
        "The Toolbar's second Action selected on the Default · Light frame, as its nested components select it.",
        (viewport) => <ToolbarSet selected="secondary" viewport={viewport} />,
      ),
    ],
  ),
  slug: "component-set",
  rationale:
    "Props edits one saved variant at a time, so a variant set asks for one: a variant in Inspect selects its Light frame, and a click selects any frame.",
  title: "Component set",
});
