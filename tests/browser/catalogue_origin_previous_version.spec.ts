import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { VIEWER_DIRECTORY } from "@mokly/model";

import { generatedResourcePath } from "../../packages/viewer/src/catalogue/delivery_paths.js";
import {
  documentRoute,
  snapshotDocumentPath,
  snapshotResourcePath,
  viewHref,
} from "../../packages/viewer/src/navigation/routes.js";
import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import {
  comparisonPaths,
  type ComparisonAdditions,
} from "../helpers/comparison_catalogue.js";
import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";
import { write } from "../helpers/static_changes.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { test as browserTest } from "./browser_test.js";
import { startComparisonStaticHost } from "./comparison_static_setup.js";
import { comparisonIndex, snapshotOf } from "./comparison_ui.js";
import { documentFaces, loadedViewerFaces } from "./document_faces.js";

const PAGE = "pages/pictured";
const PICTURE = "pictures/dot.svg";
const NOTES = "pictures/notes.txt";
const renderedFolder = path.posix.dirname(
  generatedResourcePath(documentRoute(PAGE, "light")),
);
const pictureLink = path.posix.relative(renderedFolder, PICTURE);
const notesLink = path.posix.relative(renderedFolder, NOTES);
const PREVIEW = "iframe[data-mokly-preview-frame]";

const addPicturedPage: ComparisonAdditions = async (root, side) => {
  const source = `specs/${PAGE}.page.html`;
  if (side === "After") {
    await fs.rm(path.join(root, source));
    return;
  }
  await write(
    root,
    source,
    `---
title: Retired pictures
---
<!doctype html><html><head><title>Retired pictures</title></head><body>
<h1>Retired pictures</h1>
<img src="${pictureLink}" alt="Archived dot" width="160" height="90">
<p><a href="${notesLink}">Read the picture notes</a></p>
<p><a href="#end">Jump to the end</a></p>
<div style="height:2400px">Historical pictures</div>
<h2 id="end">End of the pictures</h2>
</body></html>`,
  );
  await write(
    root,
    PICTURE,
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><circle cx="80" cy="45" r="36" fill="navy"/></svg>',
  );
  await write(root, NOTES, "These are the archived picture notes.\n");
};

const catalogueHeaders = {
  // Mirrors csp() in crates/mkc-catalogue-server/src/response.rs.
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' https://app.example.test",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  Vary: "Origin, Cookie, Authorization, Sec-Fetch-Dest, Accept-Encoding",
};

const test = browserTest.extend<object, { catalogueURL: string }>({
  catalogueURL: [
    async ({ browserName }, use) => {
      void browserName;
      const copy = await startComparisonStaticHost(
        AbortSignal.timeout(ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS),
        addPicturedPage,
        "catalogue-origin-previous-version",
      );
      ownBrowserCleanup(copy.close);
      try {
        const host = await serveStaticFiles(copy.directory, {
          headers: catalogueHeaders,
        });
        try {
          await use(host.url);
        } finally {
          await host.close();
        }
      } finally {
        await copy.close();
      }
    },
    { scope: "worker", timeout: ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
  baseURL: async ({ catalogueURL }, use) => {
    await use(catalogueURL);
  },
});

test("a previous version loads its pictures and fonts under the catalogue policy", async ({
  page,
  request,
  catalogueURL,
}) => {
  const index = await comparisonIndex(request, catalogueURL);
  const generation = new URL(index.comparisonUrl, catalogueURL);
  const document = new URL(
    snapshotDocumentPath("before", PAGE, "light"),
    generation,
  );
  const built = await request.get(document.href);
  expect(built.status()).toBe(200);
  const markup = await built.text();
  expect(markup).toContain(`src="${pictureLink}"`);
  expect(markup).toContain(`href="${notesLink}"`);

  const url = new URL(viewHref(PAGE), catalogueURL);
  url.searchParams.set("snapshot", snapshotOf(index, PAGE));
  await page.goto(url.href);
  const previous = page.frameLocator(PREVIEW);
  const picture = previous.getByRole("img", { name: "Archived dot" });
  await expect
    .poll(() =>
      picture.evaluate((image: HTMLImageElement) => ({
        address: image.currentSrc,
        loaded: image.complete && image.naturalWidth > 0,
      })),
    )
    .toEqual({
      address: new URL(snapshotResourcePath("before", PICTURE), generation)
        .href,
      loaded: true,
    });

  const notes = previous.getByRole("link", { name: "Read the picture notes" });
  const notesAddress = new URL(
    snapshotResourcePath("before", NOTES),
    generation,
  );
  await expect
    .poll(() => notes.evaluate((link: HTMLAnchorElement) => link.href))
    .toBe(notesAddress.href);
  expect((await request.get(notesAddress.href)).status()).toBe(200);

  const end = previous.getByRole("heading", { name: "End of the pictures" });
  await expect(end).not.toBeInViewport();
  await previous.getByRole("link", { name: "Jump to the end" }).focus();
  await page.keyboard.press("Enter");
  await expect(end).toBeInViewport();
  await expect(page).toHaveURL(url.href);

  const removed = comparisonPaths.removedDocument;
  const markdown = new URL(viewHref(removed), catalogueURL);
  markdown.searchParams.set("snapshot", snapshotOf(index, removed));
  await page.goto(markdown.href);
  await expect
    .poll(() => documentFaces(previous.locator("html")))
    .toEqual(
      loadedViewerFaces(
        new URL(`snapshots/${VIEWER_DIRECTORY}/fonts/`, generation).href,
      ),
    );
});
