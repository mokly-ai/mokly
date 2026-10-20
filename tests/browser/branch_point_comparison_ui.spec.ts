/**
 * The branch-point cases' rendered references in the copied branch-point
 * output at desktop and mobile widths, under the branch-point lookup
 * contract: affected destinations, saved props, removed rows, kept
 * comparison mode, Changes activation, and crumb text and links.
 */

import { BRANCH_POINT_CHECKS } from "./branch_point_checks.js";
import { test } from "./branch_point_test.js";
import { BRANCH_POINT_WIDTHS } from "./branch_point_ui.js";
import { routedHost } from "./entry_hosts.js";

for (const [name, check] of Object.entries(BRANCH_POINT_CHECKS))
  for (const { name: width, ...size } of BRANCH_POINT_WIDTHS)
    test(`${name} renders its branch-point references at ${width} width`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await check(page, routedHost);
    });
