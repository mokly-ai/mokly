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
import { build } from "./viewer/build-fixtures";

/**
 * Every state an owner's build card draws: each build state, each card
 * action, each request control's refusal and its wait. `build-states.ts`
 * keys the desktop rows by the same unions.
 */

const publishing = "Publishing this branch";
const unable = "Unable to publish this branch";
const busy = "Mokly is busy. Try again in a moment.";

export const buildCardStates: readonly CardState[] = [
  {
    name: "queued build",
    show: (page, s) =>
      openBuild(
        page,
        s,
        { id: ids.queued, state: "queued", step: null, startedAt: null },
        publishing,
      ),
  },
  {
    name: "running build with output",
    show: async (page, s) => {
      s.double.builds.set(ids.running, build({ id: ids.running }));
      write(s.double, ids.running, [{ text: "added 412 packages\n" }]);
      await openBuild(page, s, { id: ids.running }, publishing);
      await expect(page.getByTestId("build-output")).toContainText("added");
    },
  },
  {
    name: "refused Cancel",
    show: async (page, s) => {
      await openBuild(page, s, { id: ids.running }, publishing);
      s.double.refuseCancel = "unavailable";
      await page.getByTestId("build-cancel").click();
      await expect(
        page.locator(".fo-build-action .fo-write-failure [role=alert]"),
      ).toHaveText(busy);
      s.double.refuseCancel = undefined;
    },
  },
  {
    name: "running Cancel",
    show: async (page, s) => {
      await openBuild(page, s, { id: ids.running }, publishing);
      const url = `**/v1/projects/${s.projectId}/builds/${ids.running}/cancel`;
      return holdPress(page, url, "build-cancel", "Cancelling…", () =>
        expect(cardTitle(page, "Publishing was cancelled")).toBeVisible(),
      );
    },
  },
  {
    name: "cancelled build",
    show: (page, s) =>
      openBuild(
        page,
        s,
        { id: ids.cancelled, state: "cancelled", ...finished },
        "Publishing was cancelled",
      ),
  },
  {
    name: "published build",
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
  },
  {
    name: "failed build",
    show: (page, s) =>
      openBuild(
        page,
        s,
        { id: ids.failed, state: "failed", failure: exitFailure, ...finished },
        unable,
      ),
  },
  {
    name: "running Try again",
    show: async (page, s) => {
      queueNext(s);
      await openBuild(
        page,
        s,
        { id: ids.failed, state: "failed", failure: exitFailure, ...finished },
        unable,
      );
      const url = `**/v1/projects/${s.projectId}/builds`;
      return holdPress(page, url, "build-try-again", "Publishing…", () =>
        page.waitForURL((at) => at.pathname === s.buildAt(ids.next)),
      );
    },
  },
  {
    name: "timed-out build",
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
  },
  {
    name: "superseded build",
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
  },
  {
    name: "plan refusal with Open billing",
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
  },
  {
    name: "lockfile refusal with Publish from CI",
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
  },
  {
    name: "Try again refused for a closed pull request",
    show: async (page, s) => {
      await refuseTryAgain(page, s, ids.closed, "closed");
      s.double.refuseRequest = undefined;
    },
  },
  {
    name: "Try again refused for a fork",
    show: async (page, s) => {
      await refuseTryAgain(page, s, ids.fork, "fork");
      s.double.refuseRequest = undefined;
    },
  },
];
