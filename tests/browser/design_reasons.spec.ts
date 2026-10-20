/**
 * Every Browse design of a changed, added, or removed screen shows its
 * comparison details with one sentence per direct reason, as the viewer's
 * Details do, under the component workspace design contract. A stylesheet
 * reason reads only through the changed files, so a design whose only reason
 * is a stylesheet shows no reason sentence, and neither does an unchanged
 * screen or a page.
 */

import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { designFileUrl } from "./design_fixture.js";
import {
  expectReasonSentences,
  REASON_SENTENCES,
  type SentenceReason,
} from "./design_reason_sentences.js";
import { documentFavicon } from "./document_error_allowance.js";

/** Each design's depicted direct reasons that have a sentence. */
const REASONS: Readonly<Record<string, readonly SentenceReason[]>> = {
  "design/browse/appearance/workspaces/difference": ["material"],
  "design/browse/appearance/workspaces/side-by-side": ["material"],
  "design/browse/index-entries/member-changes": ["material"],
  "design/browse/publication/changes": ["material"],
  "design/browse/variants/variant-changes": ["material"],
  "design/browse/variants/variant-removed": ["removed"],
  "design/browse/variants/variant-reparented": ["removed"],
  "design/changes/diff-controls/current": ["material"],
  "design/changes/diff-controls/overlay": ["material"],
  "design/changes/diff-controls/overlay-long": ["material"],
  "design/changes/diff-controls/overlay-panel": ["material"],
  "design/changes/diff-controls/side-by-side-apart": ["material"],
  "design/changes/impact/ignored-only": [],
  "design/changes/impact/styles/matched-excluded/excluded": [],
  "design/changes/impact/styles/matched-excluded/excluded-only": [],
  "design/changes/impact/styles/matched-excluded/matched": [],
  "design/changes/impact/styles/page": [],
  "design/changes/impact/styles/unresolved-unnamed/unnamed": [],
  "design/changes/impact/styles/unresolved-unnamed/unresolved": [],
  "design/changes/outcomes/added": ["added"],
  "design/changes/outcomes/changed": ["material"],
  "design/changes/outcomes/difference": ["material"],
  "design/changes/outcomes/moved": ["material"],
  "design/changes/outcomes/previous-version/loading": ["removed"],
  "design/changes/outcomes/previous-version/long": ["removed"],
  "design/changes/outcomes/previous-version/no-view": ["removed"],
  "design/changes/outcomes/previous-version/unavailable": ["removed"],
  "design/changes/outcomes/removed": ["removed"],
};

const BRANCH_POINT = "Compared with the branch point on origin/main.";

test.beforeEach(({ allowBrowserError, baseURL }) => {
  documentFavicon(allowBrowserError, baseURL!);
});

/** Open one design artboard of the example catalogue. */
async function openDesign(page: Page, route: string, viewport: string) {
  const file = path.join(
    repositoryRoot,
    "examples/basic/mokly-generated",
    route,
    `index.${viewport}.html`,
  );
  await page.goto(designFileUrl(file).href);
}

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: Browse designs read one sentence per reason in their comparison details`, async ({
    page,
  }) => {
    for (const [route, reasons] of Object.entries(REASONS)) {
      await openDesign(page, route, viewport);
      const details = page.locator(".mbk-comparison-details");
      await expect(details, route).toHaveCount(1);
      await expectReasonSentences(details, reasons, `${viewport} ${route}`);
    }
    // A moved screen names its earlier side before its reason.
    await openDesign(page, "design/changes/outcomes/moved", viewport);
    await expect(page.locator(".mbk-comparison-details > p")).toHaveText([
      BRANCH_POINT,
      /^The previous version is at .+, where it was before the move\.$/u,
      REASON_SENTENCES.material,
    ]);
  });
