import type {
  DepictedView,
  HighlightRegion,
  PreviewRegions,
} from "../../parts/depicted_view.js";
import type { DesignDestination } from "../../parts/destinations.js";
import { MiniProfile } from "../../parts/mini_account.js";
import { MiniAction } from "../../parts/mini_action.js";
import { MiniWelcome } from "../../parts/mini_screens.js";
import { miniView } from "../../parts/mini_views.js";
import { PaymentTerms } from "../../parts/spec_documents.js";

import {
  componentFrames,
  readingFrame,
  screenFrames,
  type FrameScheme,
} from "./frames.js";
import { WELCOME_INSTANCES } from "./welcome_instances.js";

/**
 * The zoom in percent that fits each stage: a screen's four frames, Welcome's
 * two Light frames once the Frames filter hides Dark, Profile's two, the two
 * versions of a desktop frame side by side, the Action's variant set and a
 * reading frame at full size, and, in the compact form, a phone frame, a
 * desktop frame, a variant set, and two phone frames side by side.
 */
export const FITS = {
  welcome: 38,
  welcomeLight: 42,
  profile: 42,
  sideBySide: 29,
  action: 100,
  document: 100,
  phone: 72,
  phoneDesktop: 27,
  phoneSet: 50,
  phoneSide: 44,
} as const;

/**
 * Welcome's four frames: the example's Welcome in each viewport and scheme.
 * Its link stays inert, because Canvas links stay inside the Canvas family.
 */
export function welcomeFrames() {
  return screenFrames((viewport) => (
    <MiniWelcome compact={viewport === "mobile"} inert />
  ));
}

/** Welcome's depicted view, whose instances the highlight marks. */
export const WELCOME_VIEW = miniView("welcome");

/**
 * The artboard that shows each instance of Welcome selected, by the shell's
 * label of the instance: its component's title and its id.
 */
const SELECTED_BY_LABEL: Readonly<Record<string, DesignDestination>> =
  Object.fromEntries(
    Object.values(WELCOME_INSTANCES).map((instance) => [
      `${instance.component} · ${instance.id}`,
      instance.page,
    ]),
  );

/** A view's regions, each label opening the artboard of its selection. */
function linkedRegions(regions: PreviewRegions): PreviewRegions {
  const link = (region: HighlightRegion): HighlightRegion => ({
    ...region,
    to: SELECTED_BY_LABEL[region.label],
  });
  const [first, ...rest] = regions;
  return [link(first), ...rest.map(link)];
}

/**
 * Welcome while the shell highlights it: the mask and the labels show, and a
 * label opens the artboard that shows its instance selected.
 */
export function welcomeHighlighted(): DepictedView {
  if (!("regions" in WELCOME_VIEW)) return WELCOME_VIEW;
  return {
    highlight: "on",
    regions: {
      desktop: linkedRegions(WELCOME_VIEW.regions.desktop),
      mobile: linkedRegions(WELCOME_VIEW.regions.mobile),
    },
  };
}

/** Profile renders in Light only, so it has the Light row of frames. */
export function profileFrames() {
  return screenFrames(
    (viewport) => <MiniProfile compact={viewport === "mobile"} />,
    ["light"],
  );
}

/** The nominal size of the Action's component document. */
const ACTION_DOCUMENT = { width: 320, height: 132 } as const;

/** The Action's variant set: Default, Disabled, and Secondary. */
export function actionFrames() {
  return componentFrames(
    [
      {
        slug: "default",
        title: "Default",
        render: () => <MiniAction variant="default" />,
      },
      {
        slug: "disabled",
        title: "Disabled",
        render: () => <MiniAction variant="disabled" />,
      },
      {
        slug: "secondary",
        title: "Secondary",
        render: () => <MiniAction variant="secondary" />,
      },
    ],
    ACTION_DOCUMENT,
  );
}

/**
 * The Payment terms document as one reading frame, in Mokly's own Markdown
 * typography, which reads in the catalogue's appearance.
 */
export function paymentTermsFrames(scheme: FrameScheme) {
  return [
    readingFrame(
      "payment-terms.md",
      <div className="mbk-markdown">
        <article className="mbk-markdown-body">
          <PaymentTerms />
        </article>
      </div>,
      { width: 760, height: 620 },
      scheme,
    ),
  ];
}
