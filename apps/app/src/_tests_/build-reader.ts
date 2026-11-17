import type { Page } from "@playwright/test";

import type { Build, Project } from "../api/types";

import { expect } from "./harness";
import { build } from "./viewer/build-fixtures";

/**
 * A build read by a reviewer, as the `queued` variant of
 * `product/viewer/standalone/build/reader` draws it. A reviewer reads builds
 * but may neither request nor cancel one, so the project reports no request
 * and the build no Cancel, and the workspace calls the reader a reviewer.
 */

/** What the project reports to a reviewer: it builds, but not for them. */
export const reviewerProject: Partial<Project> = {
  buildsAvailable: true,
  canRequestBuilds: false,
  canAdmin: false,
};

/** Answer the workspace read with the reader's role as a reviewer. */
export async function readAsReviewer(page: Page): Promise<void> {
  await page.route("**/v1/workspaces/*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const answer = await route.fetch();
    const body = (await answer.json()) as { role: string };
    return route.fulfill({
      response: answer,
      json: { ...body, role: "reviewer" },
    });
  });
}

/** A requested build no worker has claimed, which the reader may not cancel. */
export function queuedForReviewer(id: string, projectId: string): Build {
  return build({
    id,
    projectId,
    state: "queued",
    step: null,
    startedAt: null,
    canCancel: false,
  });
}

/**
 * The card a reviewer's queued build shows: its title, “Waiting to start.”,
 * every step waiting, and no action at all.
 */
export async function expectWaitingWithNoAction(page: Page): Promise<void> {
  const card = page.locator(".fo-build");
  await expect(
    card.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(card.locator(".fo-build-line")).toHaveText("Waiting to start.");
  for (const step of ["checkout", "install", "publish"])
    await expect(card.locator(`[data-mkc-build-step="${step}"]`)).toContainText(
      "Waiting",
    );
  await expect(page.getByTestId("build-cancel")).toHaveCount(0);
  await expect(card.locator(".fo-build-action")).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("alert")).toHaveCount(0);
}
