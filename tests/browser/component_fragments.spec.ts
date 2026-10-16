import { expect } from "@playwright/test";

import { viewRoute } from "@mokly/viewer/data";

import { browserSources } from "../../packages/viewer/tests/browser_sources.js";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";

let fixture: Awaited<ReturnType<typeof serveCatalogue>>;
const expectedEntries = [
  "action",
  "action/default",
  "action/disabled",
  "pane",
  "pane/default",
];
test.beforeAll(async () => {
  fixture = await serveCatalogue(
    {
      "specs/index.mockup.tsx": browserSources({
        body: '<pane.Component><action.Component label="Slot action" /></pane.Component><MockLink to="action/default">Open Action</MockLink>',
        actionRender:
          "(props, context) => <button disabled={props.disabled} data-viewport={context.viewport} data-scheme={context.colorScheme}>{props.label}</button>",
      }),
    },
    { colorSchemes: ["light", "dark"] },
  );
  const index = await (
    await fetch(`${fixture.url}/mokly-viewer/index.json`)
  ).json();
  expect(
    index.components.map((entry: { path: string }) => entry.path).sort(),
  ).toEqual(expectedEntries);
});
test.afterAll(async () => fixture?.close());

for (const viewport of ["mobile", "desktop"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${viewport}/${scheme}: parent props and saved component variants have portable documents`, async ({
      page,
    }) => {
      const url = (entry: string) =>
        `${fixture.url}/static/mokly-generated/${viewRoute(entry, viewport, scheme)}`;
      await page.goto(url("home"));
      await expect(
        page.getByRole("button", { name: "Slot action", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Inside", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Open Action" }).click();
      await expect(page).toHaveURL(url("action/default"));
      for (const entry of expectedEntries) {
        await page.goto(url(entry));
        const button = page.getByRole("button", {
          name: entry.startsWith("action") ? "Continue" : "Inside",
          exact: true,
        });
        await expect(button).toHaveAttribute("data-viewport", viewport);
        await expect(button).toHaveAttribute("data-scheme", scheme);
        if (entry === "action/disabled") await expect(button).toBeDisabled();
        else await expect(button).toBeEnabled();
        if (entry === "pane/default")
          await expect(
            page.getByText("Saved content", { exact: true }),
          ).toBeVisible();
      }
    });
  }
}
