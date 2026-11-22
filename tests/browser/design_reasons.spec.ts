/**
 * Every Canvas design that shows comparison details reads one sentence per
 * direct reason, as the viewer's Details do, under the component workspace
 * design contract. A stylesheet reason reads only through the changed files,
 * so a design whose only reason is a stylesheet shows no reason sentence,
 * and neither does an unchanged entry or a page. Every built Canvas design
 * whose Changes tab is open, or that draws comparison details, must be in
 * the list, so a new design of a change cannot leave out its reasons. An
 * unchanged entry without evidence draws no comparison details. The older
 * designs of a removed entry keep their reasons until the Canvas family
 * draws a removed entry's previous version.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";
import { designFileUrl } from "./design_fixture.js";
import {
  expectReasonSentences,
  REASON_SENTENCES,
  type SentenceReason,
} from "./design_reason_sentences.js";
import { documentFavicon } from "./document_error_allowance.js";

type Viewport = "desktop" | "mobile";

/** A design, its depicted direct reasons, and the artboards that show them. */
type ReasonRow = readonly [
  route: string,
  reasons: readonly SentenceReason[],
  viewports: readonly Viewport[],
];

/** Both artboards draw the comparison details. */
const BOTH = ["desktop", "mobile"] as const;
/** A phone shows the frames of a comparison with the panel sheet closed. */
const DESKTOP = ["desktop"] as const;

/** Each Canvas design's depicted direct reasons that have a sentence. */
const REASONS: readonly ReasonRow[] = [
  ["design/canvas/changes/current", ["material"], BOTH],
  ["design/canvas/changes/side-by-side", ["material"], DESKTOP],
  ["design/canvas/changes/overlay", ["material"], DESKTOP],
  ["design/canvas/changes/difference", ["material"], DESKTOP],
  ["design/canvas/changes/swipe", ["material"], DESKTOP],
  ["design/canvas/components/affected", [], DESKTOP],
  ["design/canvas/components/affected/details", [], DESKTOP],
  ["design/canvas/components/compare", ["material"], DESKTOP],
  ["design/canvas/components/compare/current", ["material"], BOTH],
  ["design/canvas/components/compare/difference", ["material"], DESKTOP],
  ["design/canvas/components/compare/side-by-side", ["material"], DESKTOP],
  ["design/canvas/components/removed/changes", ["removed"], DESKTOP],
  ["design/canvas/evidence/ignored", [], BOTH],
  ["design/canvas/evidence/page", [], BOTH],
  ["design/canvas/evidence/styles", [], BOTH],
  ["design/canvas/evidence/styles/excluded", [], BOTH],
  ["design/canvas/evidence/styles/unnamed", [], BOTH],
  ["design/canvas/evidence/styles/unresolved", [], BOTH],
  ["design/canvas/evidence/unchanged", [], BOTH],
  ["design/canvas/evidence/unchanged/action", [], BOTH],
  ["design/canvas/outcomes/added/changes", ["added"], BOTH],
  ["design/canvas/outcomes/moved", ["material"], DESKTOP],
];

/** Unchanged Canvas entries without evidence, which draw no details. */
const NO_EVIDENCE = [
  "design/canvas/inspect/unchanged",
  "design/canvas/props/editing/edited",
  "design/canvas/stage/component-set",
];

/** The older designs of a removed entry and its previous version. */
const REMOVED = [
  "design/browse/variants/variant-removed",
  "design/changes/outcomes/previous-version/loading",
  "design/changes/outcomes/previous-version/long",
  "design/changes/outcomes/previous-version/no-view",
  "design/changes/outcomes/previous-version/unavailable",
  "design/changes/outcomes/removed",
];

/** The Canvas designs of the shell design inventory. */
const CANVAS_DESIGN = /^design\/canvas\//u;

test.beforeEach(({ allowBrowserError, baseURL }) => {
  documentFavicon(allowBrowserError, baseURL!);
});

/** Open one design artboard of the example catalogue. */
async function openDesign(page: Page, route: string, viewport: Viewport) {
  const file = path.join(
    repositoryRoot,
    "examples/basic/mokly-generated",
    route,
    `index.${viewport}.html`,
  );
  await page.goto(designFileUrl(file).href);
}

/** One built design's desktop document, served or copied. */
async function designSource(
  request: APIRequestContext,
  route: string,
): Promise<string> {
  const url = designFileUrl(
    path.join(
      repositoryRoot,
      "examples/basic/mokly-generated",
      route,
      "index.desktop.html",
    ),
  );
  if (url.protocol === "file:") return readFile(fileURLToPath(url), "utf8");
  const response = await request.get(url.href);
  expect(response.ok(), route).toBe(true);
  return response.text();
}

test("every Canvas design that opens Changes or shows comparison details lists its reasons", async ({
  baseURL,
  page,
  request,
}) => {
  const response = await request.get(`${baseURL}/mokly-viewer/index.json`);
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as { screens: { path: string }[] };
  const marked: string[] = [];
  const seen = new Set<string>();
  for (const { path: route } of index.screens) {
    if (!CANVAS_DESIGN.test(route)) continue;
    const design = await page.evaluate(
      (html) => {
        const document = new DOMParser().parseFromString(html, "text/html");
        // The right panel's selected tab, and the shipped evidence that its
        // comparison details hold.
        return {
          changes:
            document.querySelector(
              '.cv-ptab[data-tab="changes"][data-selected]',
            ) !== null,
          details:
            document.querySelector(".cv-evidence .mbk-comparison-evidence") !==
            null,
        };
      },
      await designSource(request, route),
    );
    if (design.changes) seen.add("changes tab");
    if (design.details) seen.add("comparison details");
    if (design.changes || design.details) marked.push(route);
  }
  // Each mark occurs, so a renamed class or a lost marker cannot narrow the
  // check unseen.
  expect([...seen].sort()).toEqual(["changes tab", "comparison details"]);
  const listed = new Set(REASONS.map(([route]) => route));
  expect(marked.filter((route) => !listed.has(route))).toEqual([]);
});

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: Canvas designs read one sentence per reason in their comparison details`, async ({
    page,
  }) => {
    for (const [route, reasons] of REASONS.filter(([, , shown]) =>
      shown.includes(viewport),
    )) {
      await openDesign(page, route, viewport);
      // The facts appear once, in the comparison details of the panel.
      await expect(page.locator(".mbk-comparison-evidence"), route).toHaveCount(
        1,
      );
      const details = page.locator(".cv-evidence .mbk-comparison-evidence");
      await expect(details, route).toHaveCount(1);
      await expect(details, route).toContainText("Comparison details");
      await expect(details, route).not.toContainText("corners and spacing");
      await expectReasonSentences(details, reasons, `${viewport} ${route}`);
    }
    for (const route of NO_EVIDENCE) {
      await openDesign(page, route, viewport);
      await expect(page.locator(".cv-root"), route).toHaveCount(1);
      await expect(page.locator(".mbk-comparison-evidence"), route).toHaveCount(
        0,
      );
    }
    for (const route of REMOVED) {
      await openDesign(page, route, viewport);
      const details = page.locator(".mbk-comparison-details");
      await expect(details, route).toHaveCount(1);
      await expectReasonSentences(details, ["removed"], `${viewport} ${route}`);
    }
  });

test("the moved Canvas design names its previous path before its reason", async ({
  page,
}) => {
  await openDesign(page, "design/canvas/outcomes/moved", "desktop");
  await expect(
    page.locator(".cv-evidence .mbk-comparison-evidence > p"),
  ).toHaveText([
    /^The previous version is at .+, where it was before the move\.$/u,
    REASON_SENTENCES.material,
  ]);
});
