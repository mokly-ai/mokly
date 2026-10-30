/**
 * Every Browse design of a changed, added, or removed screen shows its
 * comparison details with one sentence per direct reason, as the viewer's
 * Details do, under the component workspace design contract. A stylesheet
 * reason reads only through the changed files, so a design whose only reason
 * is a stylesheet shows no reason sentence, and neither does an unchanged
 * screen or a page. Every built Browse design whose selected row or title row
 * marks a changed, added, or removed entry must be in the list, so a new
 * design of a changed screen cannot leave out its reasons.
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

/** Each design's depicted direct reasons that have a sentence. */
const REASONS: Readonly<Record<string, readonly SentenceReason[]>> = {
  "design/browse/appearance/workspaces/difference": ["material"],
  "design/browse/appearance/workspaces/side-by-side": ["material"],
  "design/browse/index-entries/member-changes": ["material"],
  "design/browse/publication/changes": ["material"],
  "design/browse/variants/changed-views": ["material"],
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
/** The Browse and Changes designs of the shell design inventory. */
const BROWSE_DESIGN = /^design\/(?:browse|changes)\//u;
/** Kinds whose designs show no reason sentences, by the row's entry kind. */
const EXCEPTED_KINDS = new Set(["page", "document", "use-case"]);
/** Title-row badges that mark a changed, added, or removed entry. */
const CHANGE_BADGES = new Set(["added", "changed", "removed"]);

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

test("every Browse design of a changed, added, or removed entry lists its reasons", async ({
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
    if (!BROWSE_DESIGN.test(route)) continue;
    const design = await page.evaluate(
      (html) => {
        const document = new DOMParser().parseFromString(html, "text/html");
        // The shipped row names the current page, carries its changed mark
        // as an attribute, and keeps the mark's wording beside its label.
        const rows = [
          ...document.querySelectorAll('.mbk-nav-row[aria-current="page"]'),
        ];
        const row = rows.at(-1);
        const label = [...(row?.childNodes ?? [])]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join("")
          .trim();
        return {
          kind: row?.getAttribute("data-entry-kind") ?? "",
          changed: row?.getAttribute("data-changed") === "true",
          removed: /· Removed$/u.test(label),
          badge:
            document
              .querySelector(".mbk-title-row .ce-change-status")
              ?.getAttribute("data-change-status") ?? "",
        };
      },
      await designSource(request, route),
    );
    if (design.changed) seen.add("changed row");
    if (design.removed) seen.add("removed row");
    if (design.badge === "added") seen.add("added badge");
    if (EXCEPTED_KINDS.has(design.kind)) {
      seen.add(design.kind);
      continue;
    }
    if (design.changed || design.removed || CHANGE_BADGES.has(design.badge))
      marked.push(route);
  }
  // Each mark and each excepted kind occurs, so a renamed class or a lost
  // marker cannot narrow the check unseen.
  expect([...seen].sort()).toEqual([
    "added badge",
    "changed row",
    "document",
    "page",
    "removed row",
    "use-case",
  ]);
  expect(marked.filter((route) => !Object.hasOwn(REASONS, route))).toEqual([]);
});

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
