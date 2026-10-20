/**
 * A light-only screen's Dark deep link resolves to its Light views in Serve.
 * A real background update that puts the screen in Changes through a
 * metadata edit, with every view unchanged, keeps the effective Light
 * status: Unmodified, Current, no comparison band, and no request.
 */

import { expect } from "@playwright/test";

import { test } from "./serve_comparison_test.js";
import { selectedRequests } from "./serve_comparison_ui.js";

test("a light-only screen deep link keeps effective Light evidence through a background update", async ({
  page,
  changes,
}) => {
  const stable = changes.paths.unchanged;
  const requests = selectedRequests(page);
  await page.goto(`/view/${stable}/?scheme=dark&comparison=side`);
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");

  await changes.edit(
    `specs/${stable}.screen.html`,
    "---\ntitle: Stable screen\ndescription: The stable screen after review\ncolorSchemes: [light]\n---\n<h1>Stable screen</h1>",
    (index) => {
      const entry = index.screens.find((screen) => screen.path === stable);
      return (
        entry?.changes.status === "ready" &&
        entry.changes.included &&
        entry.views.every(
          (view) =>
            view.comparison.status === "ready" &&
            view.comparison.kind === "unmodified",
        )
      );
    },
  );

  const details = page.getByRole("tab", { name: "Details", exact: true });
  if ((await details.getAttribute("aria-selected")) !== "true")
    await details.click();
  await expect(
    page.getByRole("tabpanel", { name: "Details", exact: true }),
  ).toContainText("The stable screen after review");
  await expect(page.locator("[data-workspace-status]")).toHaveText(
    "Unmodified",
  );
  await expect(page.locator(".mbk-diff-toolbar")).toBeHidden();
  // The hidden band keeps Current as its only selection.
  await expect(page.locator('[data-diff-mode="current"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-mokly-appearance-select]")).toHaveValue(
    "dark",
  );
  await expect(page.locator('[data-view-changed="scheme"]')).toBeHidden();
  for (const frame of await page.locator("[data-workspace-frame]").all())
    await expect(frame).not.toHaveAttribute("src", /\.dark\.html$/u);
  expect(requests).toEqual([]);
});
