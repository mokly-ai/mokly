import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { buildStaticCatalogue } from "../helpers/build_site.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { hasMarker, markPage } from "./browse_assertions.js";
import { test } from "./browser_test.js";
import { staticRequests } from "./static_delivery_assertions.js";

let root: string;
let site: string;
let next: string;
let host: Awaited<ReturnType<typeof serveStaticFiles>>;
let identities: string[];
test.beforeAll(async () => {
  root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "static-deploy-",
    ),
  );
  ownBrowserCleanup(async () => {
    await host?.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  const source = path.join(root, "source");
  site = path.join(root, "site");
  next = path.join(root, "next");
  await fs.mkdir(path.join(source, "specs"), { recursive: true });
  await fs.writeFile(
    path.join(source, "mokly.config.json"),
    JSON.stringify({ repoRoot: ".", roots: [{ dir: "specs" }] }),
  );
  await fs.writeFile(
    path.join(source, "specs/home.screen.html"),
    '---\ntitle: Home\n---\n<main><a mokly-link="details">Next</a></main>',
  );
  await fs.writeFile(
    path.join(source, "specs/details.screen.html"),
    "---\ntitle: Details\n---\n<main>Original detail</main>",
  );
  await buildStaticCatalogue(source, path.join(source, "built"));
  await fs.cp(path.join(source, "built"), site, { recursive: true });
  await fs.writeFile(
    path.join(source, "specs/details.screen.html"),
    "---\ntitle: New details\n---\n<main>New deployment detail</main>",
  );
  await buildStaticCatalogue(source, path.join(source, "next"));
  await fs.cp(path.join(source, "next"), next, { recursive: true });
  const indexes = await Promise.all(
    [site, next].map(async (dir) =>
      JSON.parse(
        await fs.readFile(path.join(dir, "mokly-viewer/index.json"), "utf8"),
      ),
    ),
  );
  identities = indexes.map((index) => index.deploymentId);
  expect(indexes.map((index) => index.comparisonUrl)).toEqual([null, null]);
  await fs.rm(source, { recursive: true });
  host = await serveStaticFiles(() => site);
});

test("a copied catalogue reloads on another deployment without comparison changes", async ({
  page,
}) => {
  expect(identities[0]).not.toBe(identities[1]);
  const requests = staticRequests(page);
  await page.goto(`${host.url}/view/home/`);
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await markPage(page);
  site = next;
  await page.locator('a[data-route="details/index.html"]').click();
  await expect(page.locator("#mb-main h2")).toHaveText("New details");
  expect(await hasMarker(page)).toBe(false);
  await expect(
    page.frameLocator(".mbk-frame-mobile iframe").locator("main"),
  ).toHaveText("New deployment detail");
  await page.goBack();
  await expect(page.locator("#mb-main h2")).toHaveText("Home");
  await page.goForward();
  await expect(page.locator("#mb-main h2")).toHaveText("New details");
  requests.assert();
});
