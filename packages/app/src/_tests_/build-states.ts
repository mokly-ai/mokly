import type { ApiReason } from "../api/reasons";
import type { BuildState } from "../api/types";
import type { BuildAction } from "../viewer/build-action";
import type { RequestControl } from "../viewer/request-controls";

import { cancelBusy, publishBusy, tryAgainBusy } from "./build-state-busy";
import {
  failed,
  follow,
  published,
  superseded,
  timedOut,
} from "./build-state-cards";
import { history, switcher } from "./build-state-lists";
import type { BuildStateRow } from "./build-state-parts";
import {
  lockfile,
  planOwner,
  reviewerBuild,
  reviewerCard,
} from "./build-state-readers";
import {
  answered,
  cancelRefused,
  publishRefused,
  tryAgainRefused,
} from "./build-state-refusals";

/**
 * The one table of build states the desktop and phone build browser tests
 * read, as `web-app.md` requires: every build state, every card action, every
 * request control's refusal and its wait while its request runs, the answers
 * that open what already answers for a head, the reviewer's publishing card,
 * and builds in History and the switcher. Each record is keyed by the application's own union, so a state,
 * action or request control the application gains fails to compile here until
 * it names the row that shows it. `build-states.spec.ts` runs every row on the
 * desktop. `build-states-mobile.spec.ts` runs on a phone the two rows whose
 * steps differ there, and walks every state a card draws to see that none
 * scrolls sideways.
 */

/** The row that shows each build state. */
export const stateRows = {
  queued: follow,
  running: follow,
  published,
  failed,
  "timed-out": timedOut,
  superseded,
  cancelled: follow,
} as const satisfies Record<BuildState, BuildStateRow>;

/** The row that shows each action a build card offers, and the card with none. */
export const actionRows = {
  cancel: follow,
  "open-catalogue": published,
  "open-newer": superseded,
  "open-billing": planOwner,
  "publish-from-ci": lockfile,
  "try-again": failed,
  none: reviewerBuild,
} as const satisfies Record<BuildAction["kind"] | "none", BuildStateRow>;

/** The row that shows each request control refused beside itself. */
export const refusalRows = {
  publish: publishRefused,
  "try-again": tryAgainRefused,
  cancel: cancelRefused,
} as const satisfies Record<RequestControl, BuildStateRow>;

/** The row that holds each request control busy while its request runs. */
export const busyRows = {
  publish: publishBusy,
  "try-again": tryAgainBusy,
  cancel: cancelBusy,
} as const satisfies Record<RequestControl, BuildStateRow>;

/** The two answers that open what already answers for the head. */
type Answer = Extract<
  ApiReason,
  "build-already-active" | "build-already-published"
>;

/** The row that follows each answer to what it names. */
export const answerRows = {
  "build-already-active": answered,
  "build-already-published": answered,
} as const satisfies Record<Answer, BuildStateRow>;

/** The reviewer's publishing card, and builds in the viewer's two lists. */
export const otherRows = {
  "publish-reader": reviewerCard,
  history,
  switcher,
} as const satisfies Record<string, BuildStateRow>;

/** Every row once, in the order the desktop runs them. */
export const buildStates: readonly BuildStateRow[] = [
  ...new Set<BuildStateRow>([
    ...Object.values(stateRows),
    ...Object.values(actionRows),
    ...Object.values(refusalRows),
    ...Object.values(busyRows),
    ...Object.values(answerRows),
    ...Object.values(otherRows),
  ]),
];
