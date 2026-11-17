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
 * The output box on the desktop, as the build card composition of
 * `docs/protocol/cloud/folio-viewer.md` defines it: a labelled region a keyboard
 * reader can focus and scroll, drawn with the token focus outline, which
 * follows the newest line while the reader is at its end and stops when they
 * scroll back.
 */

test("the output follows its newest line until the reader scrolls back", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  const scenario = await buildScenario(page, "build-output-follow");
  const { double, projectId } = scenario;
  const id = buildId(90);
  double.builds.set(id, build({ id, projectId }));
  write(double, id, numbered(1, 60));
  await open(page, scenario.buildAt(id));
  const output = page.getByRole("region", { name: "Output" });
  await expect(output).toContainText("line 60");
  expect(await output.evaluate(outputView)).toMatchObject({
    newest: "line 60",
    atEnd: true,
  });

  // Tab from the card's action reaches the output, which draws the token
  // outline round its own radius.
  await page.getByTestId("build-cancel").focus();
  await page.keyboard.press("Tab");
  await expect(output).toBeFocused();
  expect(await output.evaluate(boxOutline)).toEqual(tokenBoxOutline("light"));

  // New output at the end is followed.
  write(double, id, numbered(61, 64));
  await expect(output).toContainText("line 64");
  expect(await output.evaluate(outputView)).toMatchObject({
    newest: "line 64",
    atEnd: true,
  });

  // The reader scrolls back from the keyboard: new output leaves them where
  // they are.
  await page.keyboard.press("PageUp");
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

  // Back at the end, the output follows again.
  await page.keyboard.press("End");
  await expect
    .poll(async () => (await output.evaluate(outputView)).atEnd)
    .toBe(true);
  await scrollSettled(output);
  write(double, id, numbered(69, 72));
  await expect(output).toContainText("line 72");
  expect(await output.evaluate(outputView)).toMatchObject({
    newest: "line 72",
    atEnd: true,
  });
  await expect(output).toBeFocused();
});
