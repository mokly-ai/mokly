import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { createExampleBaseline } from "../helpers/example_baseline.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { chooseViewport } from "./workspace_actions.js";

let site: Awaited<ReturnType<typeof serveStaticFiles>>;
let root: string;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  root = await fs.mkdtemp(path.join(repositoryRoot, ".context/design-export-"));
  const config = await createExampleBaseline(root);
  const git = (...args: string[]) =>
    promisify(execFile)("git", args, { cwd: root });
  const tracked = (await git("ls-files", "examples/basic/generated")).stdout
    .trim()
    .split("\n");
  expect(tracked).toHaveLength(31);
  expect(tracked.every((file) => file.endsWith(".css"))).toBe(true);
  const file = path.join(
    root,
    "examples/basic/entries/design/library/controls/tag-chip.view.tsx",
  );
  const source = await fs.readFile(file, "utf8");
  expect(source).toContain("{label}");
  await fs.writeFile(file, source.replace("{label}", "{label} revised"));
  const output = path.join(root, "site");
  await exportCatalogue(config, { base: "HEAD", outDir: output });
  site = await serveStaticFiles(output);
});
test.afterAll(async () => {
  await site?.close();
  if (root) await fs.rm(root, { recursive: true, force: true });
});

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: exported design components retain saved variants, affected consumers and read-only props`, async ({
    page,
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
    await page.goto(
      `${site.url}/view/design/library/chrome/top-bar.html?variant=search`,
    );
    await chooseViewport(page, viewport);
    await page.getByRole("tab", { name: "Props", exact: true }).click();
    await expect(page.getByLabel("Query", { exact: true })).toBeDisabled();
    const frame = page.frameLocator(`[data-workspace-frame="${viewport}"]`);
    await expect(frame.locator(".mbk-search-value")).toHaveText("tag:forms");
    await page
      .getByLabel("Saved variant", { exact: true })
      .selectOption("tag-picker");
    await expect(frame.locator(".mbk-tag-picker")).toBeVisible();
    await expect(frame.locator(".mbk-chip").first()).toContainText("revised");
    await page.goto(`${site.url}/view/design/library/controls/tag-chip.html`);
    await expect(
      page.locator(
        '[data-nav-row][data-route="design/library/controls/tag-chip.html"]',
      ),
    ).toHaveAttribute("data-changed", "true");
    await expect(
      page.locator(
        '[data-nav-row][data-route="design/browse/states/tags/picker.html"]',
      ),
    ).not.toHaveAttribute("data-changed", "true");
    await page.getByRole("tab", { name: "Usage", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Usage", exact: true }),
    ).toContainText("Tag picker");
    expect(failures).toEqual([]);
  });
