import { write } from "./build-double";
import { buildScenario } from "./build-scenario";
import { stateDocumentViolations } from "./document-policy";
import { expect, open, test } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * The build address itself: an unknown or unreadable build, the one screen it
 * is, and its UUID permalink. Builds in History and the switcher are rows of
 * the shared build state table, which `build-states.spec.ts` and
 * `build-states-mobile.spec.ts` run on both surfaces.
 */

test("an unknown build is unavailable and a failed read can be repeated", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-unknown");
  const { double, projectId } = scenario;
  await open(page, scenario.buildAt(buildId(220)));
  await expect(page.getByText("This build is unavailable")).toBeVisible();
  await expect(page.getByTestId("viewer-publication")).toHaveText("This build");
  await expect(page.locator(".fo-top-state")).toContainText(
    "Build unavailable",
  );
  await page.getByTestId("stage-choose-publication").click();
  await expect(page.getByTestId("viewer-panel-switcher")).toBeVisible();

  const id = buildId(221);
  double.builds.set(id, build({ id, projectId }));
  double.failBuild = "unavailable";
  await open(page, scenario.buildAt(id));
  await expect(page.getByText("This build couldn’t load")).toBeVisible();
  await expect(page.locator(".fo-top-state")).toContainText(
    "Build couldn’t load",
  );
  double.failBuild = undefined;
  await page.getByTestId("stage-retry").click();
  await expect(
    page.getByRole("heading", { name: "Publishing this branch" }),
  ).toBeVisible();
});

test("a build address is one screen and carries no viewer selection", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "build-policy");
  const { double, projectId } = scenario;
  const id = buildId(240);
  double.builds.set(id, build({ id, projectId }));
  write(double, id, [{ text: "Fetching origin\n" }]);
  await open(
    page,
    scenario.buildAt(id) + "?view=changes&catalogueScreen=home&panel=history",
  );
  // The selection keys name nothing here, so the route corrects them away and
  // keeps the panel the address asked for.
  await page.waitForURL(
    (url) =>
      url.pathname === scenario.buildAt(id) && url.search === "?panel=history",
  );
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator("a.skip-link")).toHaveAttribute("href", "#main");
  await expect(
    page.getByRole("heading", { level: 2, name: "Publishing this branch" }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Steps" })).toBeVisible();
  // The output is a named region a keyboard reader can reach and scroll.
  const output = page.getByRole("region", { name: "Output" });
  await expect(output).toContainText("Fetching origin");
  await output.focus();
  await expect(output).toBeFocused();
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
});

test("a build's UUID permalink keeps its tail", async ({ page }) => {
  const scenario = await buildScenario(page, "build-permalink");
  const { double, projectId } = scenario;
  const id = buildId(250);
  double.builds.set(id, build({ id, projectId }));
  await open(page, `/projects/${projectId}/builds/${id}?panel=history`);
  await page.waitForURL(
    (url) =>
      url.pathname === scenario.buildAt(id) && url.search === "?panel=history",
  );
  await expect(page.getByTestId("viewer-panel-history")).toBeVisible();
});
