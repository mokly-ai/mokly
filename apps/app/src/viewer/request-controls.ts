import { wayBack } from "../settings/write";
import type { BuildAction } from "./build-action";

/**
 * What a card control that sends a request reads after its request was
 * refused or failed where the same request could succeed: the shared way back
 * of the write-failure fragment, or its own label. A refusal the same request
 * cannot get past keeps the control's own label either way.
 */
export type RefusedLabel = "way-back" | "own-label";

/**
 * What each build card action's control does when pressed: open a page, or
 * send a request and read the given label after a refusal. Keyed by every
 * action, so an action the card gains fails to compile here until it says
 * which. Cancel keeps its label, because Try again on a build card requests a
 * new build.
 */
const buildActionControls = {
  cancel: "own-label",
  "open-catalogue": "opens",
  "open-newer": "opens",
  "open-billing": "opens",
  "publish-from-ci": "opens",
  "try-again": "way-back",
} as const satisfies Record<BuildAction["kind"], RefusedLabel | "opens">;

/** A build card action whose control sends a request. */
type BuildRequestAction = {
  [
    Kind in keyof typeof buildActionControls
  ]: (typeof buildActionControls)[Kind] extends "opens" ? never : Kind;
}[keyof typeof buildActionControls];

/**
 * Every stage card control that sends a build request: the publishing card's
 * Publish and each build card action whose control sends one. The stage
 * drawing test maps the refusals of every one of them, so a control added here
 * fails to compile there until it names their drawings.
 */
export type RequestControl = "publish" | BuildRequestAction;

/** What every request control reads after a refusal or a failure. */
export const requestControls = {
  publish: "way-back",
  cancel: buildActionControls.cancel,
  "try-again": buildActionControls["try-again"],
} as const satisfies Record<RequestControl, RefusedLabel>;

/**
 * The words a request control reads where the same request could succeed
 * after its refusal or failure: the shared way back, or its own label.
 */
export function refusedLabel(control: RequestControl, resting: string): string {
  return requestControls[control] === "own-label" ? resting : wayBack;
}
