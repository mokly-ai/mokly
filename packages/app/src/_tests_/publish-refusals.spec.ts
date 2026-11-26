import { buildScenario } from "./build-scenario";
import { expect, open, test } from "./harness";
import { branchRow } from "./viewer/build-fixtures";

/**
 * The publishing card at rest on the desktop, as
 * `product/viewer/standalone/publish` draws it: the shared control with guide
 * keeps Publish from CI beside the control. Its refused request, with the
 * guide between the refusal and Details, is the refused publish row of the
 * shared build state table in `build-states.spec.ts`.
 */

test("the publishing card at rest sets its guide beside the control", async ({
  page,
}) => {
  const scenario = await buildScenario(page, "publish-at-rest");
  scenario.double.branches = [branchRow("topic")];
  await open(page, scenario.branchAt("topic"));
  const action = page.locator(".fo-stage-card .fo-state-action");
  // The write-failure fragment's frame stands around the row at rest, so a
  // refusal never replaces the control. It draws no box of its own.
  const frame = action.locator(":scope > .fo-write-frame");
  await expect(frame).toHaveCSS("display", "contents");
  const row = frame.locator(":scope > .fo-control-guide");
  await expect(row.getByTestId("stage-publish")).toHaveText(
    "Publish this branch",
  );
  await expect(row.getByRole("link", { name: "Publish from CI" })).toHaveCount(
    1,
  );
  await expect(action.locator(".fo-write-failure, details")).toHaveCount(0);
  // The row is centred like the card around it. A part that draws no box,
  // such as the theme provider's `display: contents` wrapper, is measured
  // through to the parts it holds.
  const centred = await row.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const drawn = (element: Element): Element[] =>
      getComputedStyle(element).display === "contents"
        ? [...element.children].flatMap(drawn)
        : [element];
    const parts = [...node.children]
      .flatMap(drawn)
      .map((child) => child.getBoundingClientRect());
    const left = Math.min(...parts.map((part) => part.left)) - box.left;
    const right = box.right - Math.max(...parts.map((part) => part.right));
    return Math.abs(left - right) <= 1;
  });
  expect(centred).toBe(true);
});
