/**
 * The branch-point journeys on the copied branch output at both widths. The
 * delivery spec on the same copy owns its files and request counts.
 */

import { expect } from "@playwright/test";

import { BRANCH_POINT_CHECKS } from "./branch_point_journeys.js";
import { test } from "./branch_point_test.js";
import { BRANCH_POINT_WIDTHS } from "./branch_point_ui.js";

for (const [name, check] of Object.entries(BRANCH_POINT_CHECKS))
  for (const { name: width, ...size } of BRANCH_POINT_WIDTHS)
    test(`${name} renders its branch-point references at ${width} width`, async ({
      page,
    }) => {
      const failures: string[] = [];
      page.on("response", (response) => {
        if (response.status() >= 500)
          failures.push(`${response.status()} ${response.url()}`);
      });
      await page.setViewportSize(size);
      await check(page);
      expect(failures).toEqual([]);
    });
