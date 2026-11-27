import type { Page } from "@playwright/test";

import type { BuildState } from "../api/types";
import type { BuildAction } from "../viewer/build-action";
import type { RequestControl } from "../viewer/request-controls";

import type { CardState, Reader } from "./build-card-parts";
import {
  cancelledBuild,
  closedTryAgain,
  failedBuild,
  forkTryAgain,
  lockfileRefusal,
  planRefusal,
  publishedBuild,
  publishedCatalogue,
  queuedBuild,
  refusedCancel,
  runningBuild,
  runningCancel,
  runningTryAgain,
  supersededBuild,
  timedOutBuild,
} from "./build-card-states";
import type { BuildScenario } from "./build-scenario";
import {
  becomeReviewer,
  branchCard,
  closedPull,
  leaveWorkspace,
  outsiderCard,
  pullCard,
  refusedFromCi,
  refusedPublish,
  reviewerBranchCard,
  reviewerPullCard,
  reviewerQueued,
  reviewerRunning,
  runningPublish,
} from "./build-stage-states";

/**
 * The card states the phone walk of `build-states-mobile.spec.ts` checks for
 * sideways scrolling. Each record is keyed by the application's own union, as
 * `build-states.ts` keys the desktop rows, so a state, action or request
 * control the application gains fails to compile here until it names the
 * card state that shows it.
 */

/** The card state that shows each build state. */
const stateCards = {
  queued: queuedBuild,
  running: runningBuild,
  published: publishedBuild,
  failed: failedBuild,
  "timed-out": timedOutBuild,
  superseded: supersededBuild,
  cancelled: cancelledBuild,
} as const satisfies Record<BuildState, CardState>;

/** The card state that shows each action a build card offers, and none. */
const actionCards = {
  cancel: runningBuild,
  "open-catalogue": publishedBuild,
  "open-newer": supersededBuild,
  "open-billing": planRefusal,
  "publish-from-ci": lockfileRefusal,
  "try-again": failedBuild,
  none: reviewerRunning,
} as const satisfies Record<BuildAction["kind"] | "none", CardState>;

/** The card state that shows each request control refused beside itself. */
const refusalCards = {
  publish: refusedPublish,
  "try-again": closedTryAgain,
  cancel: refusedCancel,
} as const satisfies Record<RequestControl, CardState>;

/** The card state that holds each request control busy. */
const busyCards = {
  publish: runningPublish,
  "try-again": runningTryAgain,
  cancel: runningCancel,
} as const satisfies Record<RequestControl, CardState>;

/** The publishing cards, the other refusals, and where a card leads. */
const otherCards: readonly CardState[] = [
  branchCard,
  pullCard,
  refusedFromCi,
  forkTryAgain,
  closedPull,
  publishedCatalogue,
  reviewerQueued,
  reviewerBranchCard,
  reviewerPullCard,
  outsiderCard,
];

/** Every card state once. */
const cards: readonly CardState[] = [
  ...new Set<CardState>([
    ...Object.values(stateCards),
    ...Object.values(actionCards),
    ...Object.values(refusalCards),
    ...Object.values(busyCards),
    ...otherCards,
  ]),
];

/**
 * The walk's phases, in order: the owner's states, then the reviewer's, then
 * an outsider's. `enter` makes the signed-in owner that reader for the rest
 * of the walk.
 */
export const phases: readonly {
  reader: Reader;
  enter: (page: Page, scenario: BuildScenario) => Promise<void>;
  states: readonly CardState[];
}[] = (
  [
    { reader: "owner", enter: async () => {} },
    { reader: "reviewer", enter: becomeReviewer },
    { reader: "outsider", enter: (page: Page) => leaveWorkspace(page) },
  ] as const
).map((phase) => ({
  ...phase,
  states: cards.filter((card) => card.reader === phase.reader),
}));
