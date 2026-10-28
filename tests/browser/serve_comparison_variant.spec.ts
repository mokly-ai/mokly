import { expect } from "@playwright/test";

import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";

import { showMode } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";
import { expectCardPane } from "./serve_comparison_ui.js";

test("Serve opens Overlay for the Card variant with parent-owned stylesheet evidence", async ({
  page,
  request,
  changes,
}) => {
  await page.goto(`/view/${changes.paths.changedVariant}/?viewport=desktop`);
  const [selected] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/generations/selected-") &&
        response.url().endsWith("/") &&
        response.request().method() === "GET",
    ),
    showMode(page, "Overlay"),
  ]);
  expect(selected.status()).toBe(204);
  // The variant's detail carries the comparison facts that the panes show.
  const variant = readEntryDetail(
    await (
      await request.get(
        `/mokly-viewer/entries/${changes.paths.changedVariant}.json`,
      )
    ).json(),
  );
  expect(variant.before?.path).toBe(changes.paths.changedVariant);
  expect(variant.views[0]!.state).toBe("changed");
  expect(variant.reasons).toContainEqual({
    kind: "dependency",
    path: "static/mokly-generated/styles/theme.css",
  });
  expect(variant.views[0]!.resourceEvidence!.rules).toContainEqual({
    stylesheet: "static/mokly-generated/styles/theme.css",
    selector: ".accent",
    status: "matched",
    owner: { kind: "component", path: changes.paths.component },
  });
  for (const [pane, title] of [
    ["before", "Before"],
    ["after", "Current"],
  ] as const)
    await expect(page.locator(`.mb-pane--${pane} iframe`)).toHaveAttribute(
      "title",
      `${title} — desktop — light`,
    );
  await expectCardPane(page, "before", "Featured Before");
  await expectCardPane(page, "after", "Featured After");
  await expect(page.locator("[data-comparison-failure]")).toHaveCount(0);
});
