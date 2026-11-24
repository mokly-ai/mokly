import type {
  DepictedView,
  HighlightRegion,
  PreviewRegions,
} from "../../parts/depicted_view.js";
import { MiniProfile } from "../../parts/mini_account.js";
import { MiniWelcome } from "../../parts/mini_screens.js";
import { miniView } from "../../parts/mini_views.js";
import { PaymentTerms } from "../../parts/spec_documents.js";

import { readingFrame, screenFrames, type FrameScheme } from "./frames.js";
import { WELCOME_INSTANCES } from "./instance_records.js";
import { instanceLabel, type CanvasInstance } from "./instances.js";

/**
 * The zoom in percent that fits each stage: a screen's four frames, Welcome's
 * two Light frames once the Frames filter hides Dark, Profile's two, the two
 * versions of a desktop frame side by side, a reading frame at full size,
 * and, in the compact form, a phone frame, a desktop frame, and two phone
 * frames side by side. `SET_FITS` holds the zooms of the variant sets.
 */
export const FITS = {
  welcome: 38,
  welcomeLight: 42,
  profile: 42,
  sideBySide: 29,
  document: 100,
  phone: 72,
  phoneDesktop: 27,
  phoneSide: 44,
} as const;

/**
 * The zooms in percent that fit a variant set: the whole set on the stage of
 * a 1440 × 900 desktop, the largest zoom up to 100% that keeps the set at
 * least 10px inside the stage; and in the compact form, the whole set, and
 * one picked frame alone, each the largest zoom up to 100% that keeps the
 * frames 1px inside the 366px stage of a phone.
 */
export interface SetFit {
  zoom: number;
  phoneSet: number;
  phonePicked: number;
}

/**
 * The zooms of the Action's set, its own example's row and three saved
 * variants, whose widest frame is Default's, and of the Toolbar's set, whose
 * two 401px rows narrow the stage.
 */
export const SET_FITS = {
  action: { zoom: 100, phoneSet: 74, phonePicked: 100 },
  toolbar: { zoom: 94, phoneSet: 43, phonePicked: 90 },
} as const satisfies Record<string, SetFit>;

/**
 * Welcome's four frames: its current version on the canonical branch, the
 * revised Welcome with its introduction, in each viewport and scheme. Its
 * link stays inert, because Canvas links stay inside the Canvas family.
 */
export function welcomeFrames() {
  return screenFrames((viewport) => (
    <MiniWelcome compact={viewport === "mobile"} inert revised />
  ));
}

/** Welcome's depicted view, whose instances the highlight marks. */
export const WELCOME_VIEW = miniView("welcome-revised");

/**
 * A view's regions, each label opening the artboard that shows its instance
 * selected, by the instance records of the depicted entry.
 */
function linkedRegions(
  regions: PreviewRegions,
  records: Readonly<Record<string, CanvasInstance>>,
): PreviewRegions {
  const pages = new Map(
    Object.values(records).map((instance) => [
      instanceLabel(instance),
      instance.page,
    ]),
  );
  const link = (region: HighlightRegion): HighlightRegion => ({
    ...region,
    to: pages.get(region.label),
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
      desktop: linkedRegions(WELCOME_VIEW.regions.desktop, WELCOME_INSTANCES),
      mobile: linkedRegions(WELCOME_VIEW.regions.mobile, WELCOME_INSTANCES),
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
