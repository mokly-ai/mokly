/**
 * The build drawings and what each must draw, read from the cards of the
 * viewer builds contract: its state's title and line, its one action or none,
 * and the word each step reads. The publishing cards beside them are in
 * `stage-drawings.ts`.
 */

import { causeSentences } from "../fixtures/build-copy";
import type { FixtureBuild } from "../fixtures/build-types";
import { builds } from "../fixtures/builds";
import { billing, causes } from "../fixtures/product-states";
import { site } from "../fixtures/site";

/**
 * The card's one action: a registered button in its tone, or a link and the
 * page it opens, as every Publish from CI is drawn, or, while a read decides
 * which reader the card is for, the action's placeholder in its own place.
 */
export type DrawnAction =
  | { kind: "button"; label: string; tone: "primary" | "secondary" }
  | { kind: "link"; label: string; href: string }
  | { kind: "placeholder"; label?: undefined };

/**
 * A request the card's control sent and the API refused: the sentence the
 * write-failure fragment sets above the control, and the drawing the control
 * still opens where the same request could succeed. The control keeps its
 * label either way, and a refusal never adds a guide.
 */
export interface DrawnRefusal {
  cause: string;
  /** The drawing the control opens, or none when it leads nowhere new. */
  opens?: string;
}

/** One build drawing: the card it must draw, read from the contract's tables. */
export interface Drawing {
  path: string;
  build: FixtureBuild;
  title: string;
  line?: string;
  /** The card's one action, or none when it offers its reader nothing. */
  action?: DrawnAction;
  /** The refusal the card's Try again was answered with, when it was. */
  refusal?: DrawnRefusal;
  /**
   * The card's control while its request runs: it reads its working word
   * and leads nowhere until the request answers.
   */
  busy?: true;
  steps: [string, string, string];
}

/** A button action, primary unless the card's action is Cancel. */
function button(
  label: string,
  tone: "primary" | "secondary" = "primary",
): DrawnAction {
  return { kind: "button", label, tone };
}

export const drawings: readonly Drawing[] = [
  {
    path: "product/viewer/standalone/build",
    build: builds.running,
    title: "Publishing this branch",
    action: button("Cancel", "secondary"),
    steps: ["Done", "Running", "Waiting"],
  },
  {
    path: "product/viewer/standalone/build/empty",
    build: builds.queued,
    title: "Publishing this branch",
    line: "Waiting to start.",
    action: button("Cancel", "secondary"),
    steps: ["Waiting", "Waiting", "Waiting"],
  },
  {
    path: "product/viewer/standalone/build/published",
    build: builds.published,
    title: "Published this branch",
    action: button("Open catalogue"),
    steps: ["Done", "Done", "Done"],
  },
  {
    path: "product/viewer/standalone/build/failed",
    build: builds.failed,
    title: "Unable to publish this branch",
    line: causeSentences["exit at install"],
    action: button("Try again"),
    steps: ["Done", "Failed", "Not run"],
  },
  {
    path: "product/viewer/standalone/build/failed/timed-out",
    build: builds.timedOut,
    title: "Unable to publish this pull request",
    line: causeSentences.deadline,
    action: button("Try again"),
    steps: ["Done", "Done", "Failed"],
  },
  {
    path: "product/viewer/standalone/build/failed/infrastructure",
    build: builds.infrastructure,
    title: "Unable to publish this branch",
    line: causeSentences.infrastructure,
    action: button("Try again"),
    steps: ["Failed", "Not run", "Not run"],
  },
  {
    path: "product/viewer/standalone/build/failed/plan",
    build: builds.plan,
    title: "Publishing to private projects is on Team",
    action: button("Open billing"),
    steps: ["Not run", "Not run", "Not run"],
  },
  {
    path: "product/viewer/standalone/build/failed/version",
    build: builds.version,
    title: "Unable to publish this branch",
    line: causeSentences["unsupported-mokly-version"].replaceAll("`", ""),
    action: button("Try again"),
    steps: ["Done", "Done", "Failed"],
  },
  {
    path: "product/viewer/standalone/build/lockfile",
    build: builds.lockfile,
    title: "Unable to publish this branch",
    line: causeSentences["unsupported-lockfile"],
    action: {
      kind: "link",
      label: "Publish from CI",
      href: site.publishFromCi,
    },
    steps: ["Done", "Failed", "Not run"],
  },
  {
    path: "product/viewer/standalone/build/refused",
    build: builds.closed,
    title: "Unable to publish this pull request",
    line: causeSentences["exit at install"],
    action: button("Try again"),
    refusal: { cause: causes.closedPullRequest },
    steps: ["Done", "Failed", "Not run"],
  },
  // Cancel refused while Mokly was busy. The same request can succeed, so
  // the control still leads to the cancelled build, and it keeps Cancel,
  // because Try again on a build card requests a new build.
  {
    path: "product/viewer/standalone/build/refused/cancel",
    build: builds.running,
    title: "Publishing this branch",
    action: button("Cancel", "secondary"),
    refusal: {
      cause: causes.busy,
      opens: "product/viewer/standalone/build/superseded/cancelled",
    },
    steps: ["Done", "Running", "Waiting"],
  },
  // Cancel and Try again while their requests run. The card keeps its body,
  // and the pressed control reads its working word.
  {
    path: "product/viewer/standalone/build/cancel-busy",
    build: builds.running,
    title: "Publishing this branch",
    action: button("Cancelling…", "secondary"),
    busy: true,
    steps: ["Done", "Running", "Waiting"],
  },
  {
    path: "product/viewer/standalone/build/try-again-busy",
    build: builds.failed,
    title: "Unable to publish this branch",
    line: causeSentences["exit at install"],
    action: button("Publishing…"),
    busy: true,
    steps: ["Done", "Failed", "Not run"],
  },
  // A reviewer cannot request builds, so the failure keeps its sentence and
  // the card offers no action.
  {
    path: "product/viewer/standalone/build/reader",
    build: builds.failed,
    title: "Unable to publish this branch",
    line: causeSentences["exit at install"],
    steps: ["Done", "Failed", "Not run"],
  },
  // Everyone but an owner is told who can upgrade; while the workspace
  // read runs nobody is told anything yet, and the owner's action waits in
  // its own place.
  {
    path: "product/viewer/standalone/build/reader/plan",
    build: builds.plan,
    title: "Publishing to private projects is on Team",
    line: billing.copy.askOwner,
    steps: ["Not run", "Not run", "Not run"],
  },
  {
    path: "product/viewer/standalone/build/reader/plan-loading",
    build: builds.plan,
    title: "Publishing to private projects is on Team",
    action: { kind: "placeholder" },
    steps: ["Not run", "Not run", "Not run"],
  },
  // A reviewer cannot cancel builds either, so a queued build still says it
  // waits to start, a running one has no line, and neither offers an action.
  {
    path: "product/viewer/standalone/build/reader/queued",
    build: builds.queued,
    title: "Publishing this branch",
    line: "Waiting to start.",
    steps: ["Waiting", "Waiting", "Waiting"],
  },
  {
    path: "product/viewer/standalone/build/reader/running",
    build: builds.running,
    title: "Publishing this branch",
    steps: ["Done", "Running", "Waiting"],
  },
  {
    path: "product/viewer/standalone/build/superseded",
    build: builds.superseded,
    title: "A newer push replaced this build",
    action: button("Open the newer build"),
    steps: ["Done", "Stopped", "Not run"],
  },
  {
    path: "product/viewer/standalone/build/superseded/cancelled",
    build: builds.cancelled,
    title: "Publishing was cancelled",
    action: button("Try again"),
    steps: ["Stopped", "Not run", "Not run"],
  },
  {
    path: "product/viewer/standalone/publish/publishing",
    build: builds.setup,
    title: "Publishing this branch",
    action: button("Cancel", "secondary"),
    steps: ["Running", "Waiting", "Waiting"],
  },
  {
    path: "product/viewer/pull-request/publishing",
    build: builds.pullRequest,
    title: "Publishing this pull request",
    action: button("Cancel", "secondary"),
    steps: ["Done", "Done", "Running"],
  },
];
