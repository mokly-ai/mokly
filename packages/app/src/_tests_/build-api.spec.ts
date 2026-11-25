import { branchPathFor, publicationPathFor } from "./addresses";
import { releaseBuild, test } from "./fake-build-api";
import { expect, freshEmail, open, signIn } from "./harness";
import { observeLiveBuild } from "./live-build-observation";
import { createProject } from "./project-setup";
import { publicationReference } from "./viewer/support";

test("a real API build publishes this branch and opens its catalogue", async ({
  page,
}) => {
  await signIn(page, freshEmail("real-build"));
  const projectId = await createProject(page, "Real Build Org");
  await open(page, await branchPathFor(page, projectId, "feature/catalogue"));
  await expect(
    page.getByRole("heading", { name: "No publications yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish this branch" }).click();
  await expect(page).toHaveURL(/\/builds\/[^/]+$/);
  const buildPath = new URL(page.url()).pathname;
  const buildId = buildPath.split("/").at(-1) ?? "";
  expect(buildId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(page.getByTestId("build-output")).toContainText(
    "Recorded build output",
  );
  const publishStep = page
    .getByRole("list", { name: "Steps" })
    .getByRole("listitem")
    .filter({ hasText: "Publish" });
  await expect(publishStep).toContainText("Running");
  await expect(page.getByTestId("build-cancel")).toBeVisible();
  await expect(publicationReference(page)).toHaveText("feature/catalogue");

  // Reopen the held build with a paused clock before the card starts its timers.
  await page.goto("about:blank");
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T01:00:00Z"));
  const live = await observeLiveBuild(page, projectId, buildId);
  await open(page, buildPath);
  await expect
    .poll(live.handshake, { message: "live socket upgrade" })
    .toBe(101);
  await expect(page.getByTestId("build-output")).toContainText(
    "Recorded build output",
  );
  await expect.poll(live.snapshot).toMatchObject({ open: true, pending: 0 });
  const { reads } = await live.snapshot();
  expect(reads).toEqual(expect.arrayContaining(["getBuild", "listBuildLog"]));
  const readsBeforeAdvance = reads.length;
  await page.clock.runFor(3_000);
  expect(
    (await live.snapshot()).reads.slice(readsBeforeAdvance),
    "an open live socket suppresses the three-second build poll",
  ).toEqual([]);

  await releaseBuild(buildId);
  await expect(
    page.getByRole("heading", { name: "Published this branch" }),
    "the build notice refreshes the card while polling is paused",
  ).toBeVisible();
  await expect(publishStep).toContainText("Done");
  await expect
    .poll(async () => (await live.snapshot()).reads.slice(readsBeforeAdvance))
    .toEqual(expect.arrayContaining(["getBuild", "listBuildLog"]));
  await page.clock.resume();
  await page.getByTestId("build-open-catalogue").click();
  await expect(page).toHaveURL(
    (url) =>
      /\/publications\/[^/]+$/.test(url.pathname) &&
      url.searchParams.get("view") === "changes",
  );
  await expect(
    page.getByRole("navigation", { name: "Catalogue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Mokly" }),
  ).toBeVisible();

  // This released fixture has no comparison. Browse can open its screens.
  const publicationId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await open(page, await publicationPathFor(page, projectId, publicationId));
  await expect(
    page.getByRole("link", { name: /^Start( Changed)?$/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Start( Changed)?$/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Start", exact: true }),
  ).toBeVisible();
  await expect(publicationReference(page)).toHaveText("feature/catalogue");
});
