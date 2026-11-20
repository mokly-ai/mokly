import { focusOutline, tokenOutline } from "./build-refusals";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * Where a phone's reader lands after Cancel, and what the focused title draws
 * there, as the build card composition of `docs/protocol/cloud/folio-viewer.md`
 * defines it.
 */

test("a phone's title draws the token focus outline after Cancel from the keyboard", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const scenario = await buildScenario(page, "build-mobile-focus");
  const { double, projectId } = scenario;
  const title = page.getByRole("heading", { name: "Publishing was cancelled" });
  const keys = buildId(470);
  double.builds.set(keys, build({ id: keys, projectId }));
  await open(page, scenario.buildAt(keys));
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-scheme",
    "dark",
  );
  await page.getByTestId("build-cancel").focus();
  await page.keyboard.press("Enter");
  await expect(title).toBeFocused();
  expect(await title.evaluate(focusOutline)).toEqual(tokenOutline("dark"));

  // A press moves focus to the title as well, but the browser shows focus to
  // the keyboard only, so neither the outline nor its own ring is drawn.
  const pressed = buildId(471);
  double.builds.set(pressed, build({ id: pressed, projectId }));
  await open(page, scenario.buildAt(pressed));
  await page.getByTestId("build-cancel").click();
  await expect(title).toBeFocused();
  expect(
    await title.evaluate((node) => getComputedStyle(node).outlineStyle),
  ).toBe("none");
});
