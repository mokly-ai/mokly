import {
  boxOutline,
  numbered,
  outputView,
  scrollSettled,
  tokenBoxOutline,
} from "./build-output";
import { write } from "./build-double";
import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { build, buildId } from "./viewer/build-fixtures";

/**
 * A phone's output box: the token focus outline in the dark scheme, and the
 * newest line followed until the reader scrolls back with a swipe or wheel.
 */

test("a phone's output follows its newest line until the reader scrolls back", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const scenario = await buildScenario(page, "build-mobile-output");
  const { double, projectId } = scenario;
  const id = buildId(490);
  double.builds.set(id, build({ id, projectId }));
  write(double, id, numbered(1, 60));
  await open(page, scenario.buildAt(id));
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-scheme",
    "dark",
  );
  const output = page.getByRole("region", { name: "Output" });
  await expect(output).toContainText("line 60");
  expect(await output.evaluate(outputView)).toMatchObject({
    newest: "line 60",
    atEnd: true,
  });

  await page.getByTestId("build-cancel").focus();
  await page.keyboard.press("Tab");
  await expect(output).toBeFocused();
  expect(await output.evaluate(boxOutline)).toEqual(tokenBoxOutline("dark"));

  write(double, id, numbered(61, 64));
  await expect(output).toContainText("line 64");
  expect((await output.evaluate(outputView)).atEnd).toBe(true);

  // The reader scrolls back over the box itself.
  await output.hover();
  await page.mouse.wheel(0, -400);
  await expect
    .poll(async () => (await output.evaluate(outputView)).atEnd)
    .toBe(false);
  await scrollSettled(output);
  const back = await output.evaluate(outputView);
  write(double, id, numbered(65, 68));
  await expect(output).toContainText("line 68");
  expect(await output.evaluate(outputView)).toEqual({
    newest: "line 68",
    first: back.first,
    atEnd: false,
  });

  await page.mouse.wheel(0, 100_000);
  await expect
    .poll(async () => (await output.evaluate(outputView)).atEnd)
    .toBe(true);
  await scrollSettled(output);
  write(double, id, numbered(69, 72));
  await expect(output).toContainText("line 72");
  expect((await output.evaluate(outputView)).atEnd).toBe(true);
});
