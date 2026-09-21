import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

let site: Awaited<ReturnType<typeof serveStaticFiles>>;
let directory: string;
test.beforeAll(async () => {
  const source = componentEntrySource();
  const fixture = await createExportFixture(source, {
    extraConfig: 'colorSchemes: ["light", "dark"],',
  });
  try {
    await fs.writeFile(
      fixture.entryPath,
      source.replace(
        "<button data-viewport=",
        '<button className="revised" data-viewport=',
      ),
    );
    await exportCatalogue(fixture.config, { outDir: "site" });
    directory = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/component-static-"),
    );
    await fs.cp(fixture.output, directory, { recursive: true });
    site = await serveStaticFiles(directory);
  } finally {
    await fixture.close();
  }
});
test.afterAll(async () => {
  await site?.close();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: exported variants, comparisons and instance inspection work without the consumer repository`, async ({
    page,
  }) => {
    const requests: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) =>
      requests.push(new URL(request.url()).pathname),
    );
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1280, height: 900 }
        : { width: 390, height: 844 },
    );
    await page.goto(`${site.url}/view/components/action.html?variant=disabled`);
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    await expect(page.locator('[data-prop-control="label"]')).toBeDisabled();
    await expect(page.locator('[data-prop-control="disabled"]')).toBeChecked();
    await expect(
      page.getByText("Open this catalogue locally to edit props.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Viewport", { exact: true }).selectOption(viewport);
    await expect(
      page
        .frameLocator(`[data-workspace-frame="${viewport}"]`)
        .getByRole("button", { name: "Continue" }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Dark preview", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator(`[data-workspace-frame="${viewport}"]`)
          .evaluate(
            (frame: HTMLIFrameElement) =>
              frame.contentWindow!.location.pathname,
          ),
      )
      .toMatch(/\.dark\.html$/);
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(page.locator("[data-diff-stage] iframe")).toHaveCount(2);
    await expect(
      page.locator("[data-diff-stage] iframe").last(),
    ).toHaveAttribute(
      "src",
      new RegExp(`disabled\\.${viewport}\\.dark\\.html$`),
    );
    await page.getByRole("button", { name: "Current", exact: true }).click();
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await page
      .getByRole("tabpanel", { name: "Usage", exact: true })
      .getByRole("link", { name: "Home", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("tabpanel", { name: "Props", exact: true }),
    ).toContainText("Action");
    const toggle = page.getByRole("button", {
      name: "Highlight components",
      exact: true,
    });
    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(page.locator(".mbk-highlight-layer")).toBeVisible();
    await page.screenshot({
      path: path.join(
        repositoryRoot,
        `.context/component-static-${viewport}.png`,
      ),
    });
    await page
      .getByRole("link", { name: "Open component", exact: true })
      .click();
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(0);
    expect(
      requests.filter(
        (route) =>
          route.startsWith("/__mokly/components/") ||
          route === "/__mokly/events" ||
          route === "/__mokly/diffs/review.json",
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
