import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import {
  compileCatalogue,
  type Compilation,
} from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  type TestFixture,
} from "../helpers/fixture.js";

let fixture: TestFixture;
let compilation: Compilation;

test.beforeAll(async () => {
  fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  const config = await loadConfig(fixture.root);
  compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
});
test.afterAll(async () => {
  if (fixture) await removeFixture(fixture);
});

test("saved component variants render through standalone portable links in every viewport and scheme", async ({
  page,
}, testInfo) => {
  for (const viewport of ["mobile", "desktop"])
    for (const scheme of ["light", "dark"]) {
      await page.setViewportSize(
        viewport === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
      );
      const suffix = `${viewport}${scheme === "dark" ? ".dark" : ""}.html`;
      const url = (route: string) =>
        pathToFileURL(path.join(fixture.mockupsDir, route)).href;
      await page.goto(url(`screens/home.${suffix}`));
      await expect(
        page.getByRole("button", { name: "Slot action", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Inside", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Open Action" }).click();
      await expect(page).toHaveURL(
        url(`components/action.variants/default.${suffix}`),
      );
      await expect(
        page.getByRole("button", { name: "Continue" }),
      ).toHaveAttribute("data-viewport", viewport);
      await page.goto(url(`components/action.variants/disabled.${suffix}`));
      await expect(
        page.getByRole("button", { name: "Continue" }),
      ).toBeDisabled();
      await page.screenshot({
        path: testInfo.outputPath(`action-${viewport}-${scheme}.png`),
      });
    }
  expect(compilation.manifest.schemaVersion).toBe(6);
});
