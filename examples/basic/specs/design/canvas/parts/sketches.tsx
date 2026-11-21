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
 * versions of a desktop frame side by side, the Action's and the Toolbar's
 * variant sets and a reading frame at full size, and, in the compact form, a
 * phone frame, a desktop frame, a whole variant set, a variant set's picked
 * frame, and two phone frames side by side.
 */
export const FITS = {
  welcome: 38,
  welcomeLight: 42,
  profile: 42,
  sideBySide: 29,
  action: 100,
  toolbar: 100,
  document: 100,
  phone: 72,
  phoneDesktop: 27,
  phoneSet: 50,
  phonePicked: 100,
  phoneSide: 44,
} as const;

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
