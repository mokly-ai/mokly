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

/**
 * The zoom in percent that fits each stage: Welcome's four frames, Profile's
 * two, the Action's variant set and a reading frame at full size, and, in
 * the compact form, a phone frame, a desktop frame, and a variant set.
 */
export const FITS = {
  welcome: 38,
  profile: 42,
  action: 100,
  document: 100,
  phone: 72,
  phoneDesktop: 27,
  phoneSet: 50,
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
