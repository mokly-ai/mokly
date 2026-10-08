import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { committedExportTest } from "./committed_export_fixture.js";
import { chooseVariant, chooseViewport } from "./workspace_actions.js";

const test = committedExportTest({
  profile: "design-library",
  prefix: "mokly-design-export-",
  shellPath: "/view/design/library/chrome/top-bar/search/",
  editSource: async (root) => {
    const file = path.join(
      root,
      "examples/basic/specs/design/library/controls/tag-chip.view.tsx",
    );
    const source = await fs.readFile(file, "utf8");
    expect(source).toContain("{label}");
    await fs.writeFile(file, source.replace("{label}", "{label} revised"));
  },
});

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: exported design components retain saved variants, affected consumers and read-only props`, async ({
    page,
    committedExport: { server: site },
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
    );
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(response.url());
    });
    await page.goto(`${site.url}/view/design/library/chrome/top-bar/search/`);
    await chooseViewport(page, viewport);
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    await expect(page.getByLabel("Query", { exact: true })).toBeDisabled();
    const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
    await expect(frame.locator(".mbk-search-value")).toHaveText("tag:forms");
    await chooseVariant(page, "Tag picker");
    await expect(frame.locator(".mbk-tag-picker")).toBeVisible();
    await expect(frame.locator(".mbk-chip").first()).toContainText("revised");
    await page.goto(`${site.url}/view/design/library/controls/tag-chip/`);
    await expect(
      page.locator(
        '[data-nav-row][data-route="design/library/controls/tag-chip/index.html"]',
      ),
    ).toHaveAttribute("data-changed", "true");
    await expect(
      page.locator(
        '[data-nav-row][data-route="design/browse/views/screen/tag-picker/index.html"]',
      ),
    ).not.toHaveAttribute("data-changed", "true");
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Usage", exact: true }),
    ).toContainText("Tag picker");
    expect(failures).toEqual([]);
  });
