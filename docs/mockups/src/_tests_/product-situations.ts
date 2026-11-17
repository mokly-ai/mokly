import type { productStates } from "./product-families";
import type { ProductSituation } from "./product-situation";
import { accountEntrySituations } from "./situations/account-entry";
import { billingSituations } from "./situations/billing";
import { buildSituations } from "./situations/build";
import { memberRemovalSituations } from "./situations/member-removal";
import { memberSituations } from "./situations/members";
import { onboardingSituations } from "./situations/onboarding";
import { projectSettingsSituations } from "./situations/project-settings";
import { publishingSituations } from "./situations/publishing";
import { pullRequestSituations } from "./situations/pull-request";
import { viewerPanelSituations } from "./situations/viewer-panels";
import { viewerStageSituations } from "./situations/viewer-stage";
import { workspaceSettingsSituations } from "./situations/workspace-settings";

export const productSituations = [
  ...onboardingSituations,
  ...accountEntrySituations,
  ...workspaceSettingsSituations,
  ...memberSituations,
  ...billingSituations,
  ...memberRemovalSituations,
  ...projectSettingsSituations,
  ...viewerStageSituations,
  ...buildSituations,
  ...publishingSituations,
  ...pullRequestSituations,
  ...viewerPanelSituations,
] as const satisfies readonly ProductSituation[];

/**
 * State variants that repeat their screen's canonical drawing, and why. Every
 * screen owns its Empty, Loading and Error variants, but a product screen does
 * not always have four situations: where it has fewer, the spare variant
 * repeats the canonical content rather than inventing a situation the route
 * cannot reach. The reason is recorded here so the next author neither invents
 * one nor deletes the variant.
 */
export const repeatedStates = [
  {
    screen: "product/account/install-app",
    state: "empty",
    reason:
      "the step is drawn only while the workspace has nothing bound, which is the canonical drawing, so there is no emptier one for it to show",
  },
  {
    screen: "product/recovery/not-found",
    state: "empty",
    reason:
      "the unmatched route reads no product data, so it has no missing-data situation distinct from its canonical recovery",
  },
  {
    screen: "product/recovery/not-found",
    state: "loading",
    reason:
      "the unmatched route reads no product data, so it has no pending situation distinct from its canonical recovery",
  },
  {
    screen: "product/recovery/not-found",
    state: "error",
    reason:
      "the unmatched route reads no product data, so it has no failed-read situation distinct from its canonical recovery",
  },
] as const satisfies readonly {
  screen: string;
  state: (typeof productStates)[number];
  reason: string;
}[];

/** Every state entry path of one situation, in the order its screen lists them. */
export function situationStatePaths(
  situation: (typeof productSituations)[number],
): string[] {
  return situation.states.map((state) =>
    state === "default" ? situation.path : situation.path + "/" + state,
  );
}

/**
 * Situation screens that draw a write in flight or a read's wait. A control
 * drawn disabled is the subject of these screens, exactly as it is in an
 * empty or loading state.
 */
export const pendingSituationPaths = productSituations
  .filter((situation) => "pending" in situation && situation.pending)
  .flatMap((situation) => situationStatePaths(situation));
