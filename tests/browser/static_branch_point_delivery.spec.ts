import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { readEntryDetail } from "../../packages/viewer/src/catalogue/detail_reader.js";
import type { ReviewResultV8 } from "../../packages/viewer/src/generated/catalogue/ReviewResultV8.js";

import { branchPointCases } from "./branch_point_delivery_cases.js";
import { branchPointPaths, test } from "./branch_point_test.js";
import {
  copiedBytes,
  deliveryIndex,
  deliveryRequests,
} from "./comparison_delivery_assertions.js";
import { missingResourceNotice } from "./document_error_allowance.js";

for (const width of [390, 1280]) {
  for (const scenario of branchPointCases) {
    test(`${width}px: copied branch-point files retain ${scenario.name}`, async ({
      page,
      request,
      branchCopy,
      allowBrowserError,
    }) => {
      allowBrowserError(missingResourceNotice(`${branchCopy.url}/favicon.ico`));
      const { index, reviewUrl, generation } = await deliveryIndex(
        request,
        branchCopy.url,
      );
      const review = (await (
        await request.get(reviewUrl)
      ).json()) as ReviewResultV8;
      const entries = review.entries.flatMap((entry) => [
        entry,
        ...(entry.variants ?? []),
      ]);
      const traffic = deliveryRequests(page);
      const viewport = width === 390 ? "mobile" : "desktop";
      const file = `index.${viewport}.html`;
      await page.setViewportSize({ width, height: 900 });
      expect(await fs.readdir(path.dirname(branchCopy.directory))).toEqual([
        "isolated",
      ]);
      if (scenario.affectedComponent) {
        const address = `${branchCopy.url}/mokly-viewer/entries/${scenario.affectedComponent}.json`;
        const detail = readEntryDetail(
          JSON.parse(
            (
              await copiedBytes(request, branchCopy.directory, address)
            ).toString(),
          ),
        );
        const affected = detail.workspace!.affected.map(
          (consumer) => consumer.entryPath,
        );
        expect(affected).toEqual(
          expect.arrayContaining([
            branchPointPaths.movedConsumer,
            branchPointPaths.movedScreen,
          ]),
        );
        for (const previous of [
          branchPointPaths.previousConsumer,
          branchPointPaths.previousScreen,
        ])
          expect(affected).not.toContain(previous);
      }
      for (const pair of scenario.pairs) {
        const record = entries.find((entry) => entry.path === pair.after)!;
        expect(record.before?.path).toBe(pair.before);
        expect(record.after?.path).toBe(pair.after);
        expect(record.previousPath).toBe(pair.moved ? pair.before : undefined);
        const current = [...index.screens, ...index.components].find(
          (entry) => entry.path === pair.after,
        )!;
        expect(current.previousPath).toBe(record.previousPath);
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
        const address = `${generation}entries/${removed.entry.path}.json`;
        const detail = readEntryDetail(
          await (await request.get(address)).json(),
        );
        expect(detail.entry.path).toBe(removed.entry.path);
        expect(detail.entry.snapshotId).toBe(removed.snapshotId);
        await copiedBytes(request, branchCopy.directory, address);
        const document = `${generation}snapshots/before/mokly-generated/${removed.entry.path}/${file}`;
        const response = await page.goto(document);
        await expect(page.locator("button")).toHaveText(scenario.removed.text);
        expect(await response!.body()).toEqual(
          await copiedBytes(request, branchCopy.directory, document),
        );
        const historical = entries.find(
          (entry) => entry.path === removed.entry.path,
        )!;
        expect(historical.state).toBe("removed");
        expect(historical.before?.path).toBe(removed.entry.path);
        expect(historical.after).toBeUndefined();
      }
      if (scenario.name.startsWith("document")) {
        expect(index.documents.map((entry) => entry.path)).toContain(
          branchPointPaths.reusedParent,
        );
        expect(index.components.map((entry) => entry.path)).not.toContain(
          branchPointPaths.reusedParent,
        );
      }
      for (const address of new Set(traffic.urls))
        await copiedBytes(request, branchCopy.directory, address);
      traffic.assert();
    });
  }
}
