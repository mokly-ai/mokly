import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { documentFavicon } from "./document_error_allowance.js";
import { copiedStaticDirectory, test } from "./static_test.js";

async function files(root: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  const groups = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? files(root, path.join(prefix, entry.name))
        : [path.join(prefix, entry.name)],
    ),
  );
  return groups.flat();
}

test("the exact-file host serves every copied file byte-for-byte and rejects source paths", async ({
  request,
  baseURL,
}) => {
  const root = copiedStaticDirectory();
  const inventory = await files(root);
  expect(inventory).toContain("mokly-viewer/index.json");
  expect(inventory).toContain(
    "static/mokly-generated/example/screens/welcome/index.mobile.html",
  );
  const queue = [...inventory];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const url = `${baseURL}/${file.split(path.sep).map(encodeURIComponent).join("/")}`;
        const response = await request.get(`${url}?ignored=true`);
        expect(response.status(), file).toBe(200);
        expect(
          (await response.body()).equals(
            await fs.readFile(path.join(root, file)),
          ),
          file,
        ).toBe(true);
        expect(response.headers()["cache-control"], file).toBe("no-cache");
        expect(response.headers()["x-content-type-options"], file).toBe(
          "nosniff",
        );
        if (file.endsWith(".json"))
          expect(response.headers()["content-type"]).toBe(
            "application/json; charset=utf-8",
          );
      }
    }),
  );
  for (const file of [
    "id/example/screens/welcome/index.html",
    "mokly.config.json",
    ".git/HEAD",
    "node_modules/react/package.json",
    "mokly-viewer/events",
    "mokly-viewer/live.json",
    "mokly-viewer/components/render",
    "mokly-viewer/index",
    "static/mokly-generated/example/screens/welcome/index.mobile",
  ]) {
    const response = await request.get(`${baseURL}/${file}`);
    expect(response.status(), file).toBe(404);
    expect(await response.text()).toBe("Not found");
  }
});

test("copied portable documents work without scripts and shell routes explain the requirement", async ({
  browser,
  baseURL,
  allowBrowserError,
}) => {
  documentFavicon(allowBrowserError, baseURL!);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/view/example/screens/welcome/`);
    await expect(page.locator("noscript")).toBeVisible();
    expect(await page.locator("noscript").textContent()).toBe(
      "This catalogue needs JavaScript.",
    );
    await expect(page.locator("[data-mokly-shell]")).toBeEmpty();
    await page.goto(
      `${baseURL}/static/mokly-generated/example/screens/welcome/index.mobile.html`,
    );
    await page.getByRole("link", { name: "View details", exact: true }).click();
    await expect(page).toHaveURL(
      /\/example\/screens\/details\/index\.mobile\.html#details$/,
    );
    await page
      .locator('a[data-mokly-link-control="button"]')
      .filter({ hasText: "Return to welcome" })
      .click();
    await expect(page).toHaveURL(
      /\/example\/screens\/welcome\/index\.mobile\.html$/,
    );
  } finally {
    await context.close();
  }
});
