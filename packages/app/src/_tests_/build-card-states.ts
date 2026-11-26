import {
  exitFailure,
  finished,
  holdPress,
  ids,
  openBuild,
  queueNext,
} from "./build-card-parts";
import type { CardState } from "./build-card-parts";
import { write } from "./build-double";
import { refuseTryAgain } from "./build-refusals";
import { buildCard, cardTitle } from "./build-state-parts";
import { expect, open } from "./harness";
import { createToken, publish } from "./publish";
import { build } from "./viewer/build-fixtures";
import { publishedViewerReady } from "./viewer/support";

/**
 * The states an owner's build card draws: each build state, each card
 * action, each request control's refusal and its wait, and the catalogue a
 * published build opens. `build-card-walk.ts` keys them by the unions.
 */

const publishing = "Publishing this branch";
const unable = "Unable to publish this branch";
const busy = "Mokly is busy. Try again in a moment.";

export const queuedBuild: CardState = {
  name: "queued build",
  reader: "owner",
  show: (page, s) =>
    openBuild(
      page,
      s,
      { id: ids.queued, state: "queued", step: null, startedAt: null },
      publishing,
    ),
};

export const runningBuild: CardState = {
  name: "running build with output",
  reader: "owner",
  show: async (page, s) => {
    s.double.builds.set(ids.running, build({ id: ids.running }));
    write(s.double, ids.running, [{ text: "added 412 packages\n" }]);
    await openBuild(page, s, { id: ids.running }, publishing);
    await expect(page.getByTestId("build-output")).toContainText("added");
  },
};

export const refusedCancel: CardState = {
  name: "refused Cancel",
  reader: "owner",
  show: async (page, s) => {
    await openBuild(page, s, { id: ids.running }, publishing);
    s.double.refuseCancel = "unavailable";
    await page.getByTestId("build-cancel").click();
    await expect(
      page.locator(".fo-build-action .fo-write-failure [role=alert]"),
    ).toHaveText(busy);
    s.double.refuseCancel = undefined;
  },
};

export const runningCancel: CardState = {
  name: "running Cancel",
  reader: "owner",
  show: async (page, s) => {
    await openBuild(page, s, { id: ids.running }, publishing);
    const url = `**/v1/projects/${s.projectId}/builds/${ids.running}/cancel`;
    return holdPress(page, url, "build-cancel", "Cancelling…", () =>
      expect(cardTitle(page, "Publishing was cancelled")).toBeVisible(),
    );
  },
};

export const cancelledBuild: CardState = {
  name: "cancelled build",
  reader: "owner",
  show: (page, s) =>
    openBuild(
      page,
      s,
      { id: ids.cancelled, state: "cancelled", ...finished },
      "Publishing was cancelled",
    ),
};

export const publishedBuild: CardState = {
  name: "published build",
  reader: "owner",
  show: (page, s) =>
    openBuild(
      page,
      s,
      {
        id: ids.published,
        state: "published",
        step: "publish",
        publicationId: "019a0000-0000-7000-8000-0000000000a1",
        ...finished,
      },
      "Published this branch",
    ),
};

/** Open catalogue on a published build, which lands on Changes. */
export const publishedCatalogue: CardState = {
  name: "catalogue a published build opens, on Changes",
  reader: "owner",
  show: async (page, s) => {
    const token = await createToken(page, s.projectId);
    const made = await publish(token, s.projectId, { branch: "topic" });
    await openBuild(
      page,
      s,
      {
        id: ids.published,
        state: "published",
        step: "publish",
        publicationId: made.id,
        ...finished,
      },
      "Published this branch",
    );
    await page.getByTestId("build-open-catalogue").click();
    await page.waitForURL(
      (url) =>
        url.pathname.endsWith("/publications/" + made.id) &&
        url.searchParams.get("view") === "changes",
    );
    await publishedViewerReady(page);
  },
};

export const failedBuild: CardState = {
  name: "failed build",
  reader: "owner",
  show: (page, s) =>
    openBuild(
      page,
      s,
      { id: ids.failed, state: "failed", failure: exitFailure, ...finished },
      unable,
    ),
};

export const runningTryAgain: CardState = {
  name: "running Try again",
  reader: "owner",
  show: async (page, s) => {
    queueNext(s);
    await failedBuild.show(page, s);
    const url = `**/v1/projects/${s.projectId}/builds`;
    return holdPress(page, url, "build-try-again", "Publishing…", () =>
      page.waitForURL((at) => at.pathname === s.buildAt(ids.next)),
    );
  },
};

export const timedOutBuild: CardState = {
  name: "timed-out build",
  reader: "owner",
  show: (page, s) =>
    openBuild(
      page,
      s,
      {
        id: ids.timedOut,
        state: "timed-out",
        step: "publish",
        canCancel: false,
        failure: { step: "publish", cause: "idle", exitCode: null },
      },
      unable,
    ),
};

export const supersededBuild: CardState = {
  name: "superseded build",
  reader: "owner",
  show: (page, s) =>
    openBuild(
      page,
      s,
      {
        id: ids.superseded,
        state: "superseded",
        supersededBy: ids.running,
        canCancel: false,
      },
      "A newer push replaced this build",
    ),
};

export const planRefusal: CardState = {
  name: "plan refusal with Open billing",
  reader: "owner",
  show: (page, s) =>
    openBuild(
      page,
      s,
      {
        id: ids.plan,
        state: "failed",
        step: null,
        canCancel: false,
        failure: { step: null, cause: "plan-required", exitCode: null },
      },
      "Publishing to private projects is on Team",
    ),
};

export const lockfileRefusal: CardState = {
  name: "lockfile refusal with Publish from CI",
  reader: "owner",
  show: async (page, s) => {
    s.double.builds.set(
      ids.lockfile,
      build({
        id: ids.lockfile,
        projectId: s.projectId,
        state: "failed",
        canCancel: false,
        failure: {
          step: "install",
          cause: "unsupported-lockfile",
          exitCode: null,
        },
      }),
    );
    await open(page, s.buildAt(ids.lockfile));
    await expect(buildCard(page).locator(".fo-build-line")).toHaveText(
      "Mokly installs with npm, pnpm or Yarn.",
    );
  },
};

export const closedTryAgain: CardState = {
  name: "Try again refused for a closed pull request",
  reader: "owner",
  show: async (page, s) => {
    await refuseTryAgain(page, s, ids.closed, "closed");
    s.double.refuseRequest = undefined;
  },
};

export const forkTryAgain: CardState = {
  name: "Try again refused for a fork",
  reader: "owner",
  show: async (page, s) => {
    await refuseTryAgain(page, s, ids.fork, "fork");
    s.double.refuseRequest = undefined;
  },
};
