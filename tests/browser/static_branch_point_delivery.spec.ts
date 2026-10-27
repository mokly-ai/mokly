import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";

import { expectBadgeAffected } from "./branch_point_affected.js";
import { branchPointDeliveryCases } from "./branch_point_delivery_cases.js";
import { test } from "./branch_point_test.js";
import {
  copiedBytes,
  deliveryIndex,
  deliveryRequests,
} from "./comparison_delivery_assertions.js";
import { missingResourceNotice } from "./document_error_allowance.js";

for (const width of [390, 1280]) {
  for (const scenario of branchPointDeliveryCases) {
    test(`${width}px: copied branch-point files retain ${scenario.name}`, async ({
      page,
      request,
      branchCopy,
      allowBrowserError,
    }) => {
      allowBrowserError(missingResourceNotice(`${branchCopy.url}/favicon.ico`));
      const { index, generation } = await deliveryIndex(
        request,
        branchCopy.url,
      );
      /** One copied detail, current or removed, read through the exact-file host. */
      const copiedDetail = async (address: string) =>
        readEntryDetail(
          JSON.parse(
            (
              await copiedBytes(request, branchCopy.directory, address)
            ).toString(),
          ),
        );
      const traffic = deliveryRequests(page);
      const viewport = width === 390 ? "mobile" : "desktop";
      const file = `index.${viewport}.html`;
      await page.setViewportSize({ width, height: 900 });
      expect(await fs.readdir(path.dirname(branchCopy.directory))).toEqual([
        "isolated",
      ]);
      if (scenario.affectedComponent) {
        const detail = await copiedDetail(
          `${branchCopy.url}/mokly-viewer/entries/${scenario.affectedComponent}.json`,
        );
        expectBadgeAffected(detail.workspace!.affected);
      }
      for (const pair of scenario.pairs) {
        // The current entry's detail names the base side it compares with.
        const record = await copiedDetail(
          `${branchCopy.url}/mokly-viewer/entries/${pair.after}.json`,
        );
        expect(record.entry.path).toBe(pair.after);
        expect(record.before?.path).toBe(pair.before);
        const current = [...index.screens, ...index.components].find(
          (entry) => entry.path === pair.after,
        )!;
        expect(current.previousPath).toBe(pair.moved ? pair.before : undefined);
        if (pair.moved) {
          const missing = `${generation}snapshots/before/mokly-generated/${pair.after}/${file}`;
          expect((await request.get(missing)).status()).toBe(404);
          await expect(
            fs.stat(path.join(branchCopy.directory, new URL(missing).pathname)),
          ).rejects.toMatchObject({ code: "ENOENT" });
        }
        for (const [side, entryPath, text] of [
          ["before", pair.before, pair.text[0]],
          ["after", pair.after, pair.text[1]],
        ] as const) {
          const address = `${generation}snapshots/${side}/mokly-generated/${entryPath}/${file}`;
          const response = await page.goto(address);
          await expect(page.locator(pair.selector)).toHaveText(text);
          expect(await response!.body()).toEqual(
            await copiedBytes(request, branchCopy.directory, address),
          );
          if (pair.asset) {
            const background = await page
              .locator(".branch-badge")
              .evaluate((element) => getComputedStyle(element).backgroundImage);
            const asset = /^url\("(.+)"\)$/.exec(background)![1]!;
            expect(asset).toContain(`${generation}snapshots/${side}/`);
            await expect.poll(() => traffic.urls).toContain(asset);
            expect(
              (
                await copiedBytes(request, branchCopy.directory, asset)
              ).toString(),
            ).toContain(
              `${side === "before" ? "Before" : "After"} branch asset`,
            );
          }
        }
      }
      if (scenario.removed) {
        const removed = index.removedEntries.find(
          (entry) => entry.entry.path === scenario.removed!.path,
        )!;
        expect(removed.parentTitle).toBe(scenario.removed.parentTitle);
        const detail = await copiedDetail(
          `${generation}entries/${removed.entry.path}.json`,
        );
        expect(detail.entry.path).toBe(removed.entry.path);
        expect(detail.entry.snapshotId).toBe(removed.snapshotId);
        const document = `${generation}snapshots/before/mokly-generated/${removed.entry.path}/${file}`;
        const response = await page.goto(document);
        await expect(page.locator("button")).toHaveText(scenario.removed.text);
        expect(await response!.body()).toEqual(
          await copiedBytes(request, branchCopy.directory, document),
        );
        // A removed entry has only its base side, so every view is removed.
        expect(detail.views.length).toBeGreaterThan(0);
        for (const view of detail.views) expect(view.state).toBe("removed");
        expect(detail.before).toBeUndefined();
      }
      if (scenario.document) {
        expect(index.documents.map((entry) => entry.path)).toContain(
          scenario.document,
        );
        expect(index.components.map((entry) => entry.path)).not.toContain(
          scenario.document,
        );
      }
      for (const address of new Set(traffic.urls))
        await copiedBytes(request, branchCopy.directory, address);
      traffic.assert();
    });
  }
}
