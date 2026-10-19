import fs from "node:fs/promises";
import path from "node:path";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";

import { staticRequests } from "./static_delivery_assertions.js";

/** Read metadata outside the browser's request recorder. */
export async function deliveryIndex(
  request: APIRequestContext,
  origin: string,
) {
  const response = await request.get(`${origin}/mokly-viewer/index.json`);
  expect(response.ok()).toBe(true);
  const index: CatalogueReadModel = readCatalogueIndex(await response.json());
  expect(index.comparisonUrl).not.toBeNull();
  const reviewUrl = new URL(index.comparisonUrl!, origin).href;
  return { index, reviewUrl, generation: new URL(".", reviewUrl).href };
}

/** Observe real requests, including renewals, without replacing any response. */
export function deliveryRequests(page: Page) {
  const traffic = staticRequests(page);
  const heads: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "HEAD") heads.push(request.url());
  });
  return {
    urls: traffic.urls,
    assert() {
      traffic.assert();
      expect(heads, "copied generations never renew").toEqual([]);
    },
  };
}

/** The exact-file host must return the bytes retained in the copied artifact. */
export async function copiedBytes(
  request: APIRequestContext,
  directory: string,
  address: string,
) {
  const url = new URL(address);
  expect(url.search).toBe("");
  const bytes = await fs.readFile(path.join(directory, url.pathname));
  const response = await request.get(address);
  expect(response.ok()).toBe(true);
  expect(await response.body()).toEqual(bytes);
  return bytes;
}
