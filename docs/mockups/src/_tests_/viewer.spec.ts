import { pathToFileURL } from "node:url";

import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

import { sample } from "../fixtures/product";
import { denseViewerChrome } from "../fixtures/product-states";
import { publication, pullRequest } from "../fixtures/publications";

import { screenFile } from "./catalogue-paths";
import { rgb } from "./color-metrics";
import { viewerDocumentViolations } from "./viewer-document-policy";
import {
  accentFills,
  overlappingChrome,
  referenceTriggerLayout,
  topBarViolations,
} from "./viewer-measures";

/**
 * The chrome around every viewer screen and the entries into its stage. The
 * ready stage is checked in `viewer-ready-stage.spec.ts`, the stage's recovery
 * in `viewer-recovery.spec.ts`, its build cards in `viewer-builds.spec.ts` and
 * the panels' rows in `viewer-panels.spec.ts`.
 */

/**
 * The publication pill's names: the whole reference, the state's phrase and
 * the short SHA, which both compositions keep.
 */
const pullReference = pullRequest.number + " " + pullRequest.title;
const readyBranch = [
  publication.branch,
  "Ready · " + publication.time.split(",")[0],
  publication.sha,
].join(", ");
const readyPullRequest = [
  pullReference,
  pullRequest.author + " · Ready · 15 Sep",
  pullRequest.sha,
].join(", ");
const unpublishedPullRequest = [
  pullReference,
  pullRequest.author + " · Not published",
].join(", ");

/** The six screens of the family and whether a panel is open over the stage. */
const family = [
  ["standalone", false],
  ["pull-request", false],
  ["projects", true],
  ["switcher", true],
  ["history", true],
  ["share", true],
] as const;

for (const viewport of ["desktop", "mobile"] as const)
  for (const scheme of ["light", "dark"] as const) {
    const url = (screen: string, state?: string) =>
      pathToFileURL(
        screenFile(
          "product/viewer/" + screen + (state ? "/" + state : ""),
          viewport,
          scheme,
        ),
      ).href;
    const label = `${viewport} ${scheme}` as const;
    const size = {
      width: viewport === "mobile" ? 390 : 1440,
      height: viewport === "mobile" ? 844 : 900,
    };

    test(
      "every viewer screen keeps the chrome over one stage: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        // The solid accent of the Canvas tokens is the signal fill of a
        // filled button.
        const fill = rgb(tokens.color[scheme].accentSolid);
        for (const [screen, panel] of family)
          for (const state of ["", "empty", "loading", "error"]) {
            await page.goto(url(screen, state || undefined));
            expect(
              await page.evaluate(viewerDocumentViolations),
              label,
            ).toEqual([]);
            await expect(page.locator("[role=dialog]")).toHaveCount(
              panel ? 1 : 0,
            );
            await expect(page.getByRole("main")).toHaveCount(1);
            await expect(page.locator("h1")).toHaveCount(1);
            const published = state === "" || panel;
            await expect(page.locator(".mokly-viewer")).toHaveCount(
              published ? 1 : 0,
            );
            await expect(
              page.locator(published ? ".mbk-brand" : ".review-brand"),
            ).toHaveCount(1);
            const primaries = await page
              .getByTestId("firna-button-primary")
              .count();
            expect(primaries, screen + " " + state).toBeLessThanOrEqual(1);
            // The selected catalogue row draws the soft accent, not the
            // solid one, so only a filled button spends the solid accent.
            expect(
              await page.evaluate(accentFills, fill),
              screen + " " + state,
            ).toBe(primaries);
          }
      },
    );

    if (viewport === "mobile")
      test(
        "the chrome stays legible at 320px with enlarged text: " + label,
        async ({ page }) => {
          await page.setViewportSize({ width: 320, height: 844 });
          for (const [screen, name, role] of [
            ["standalone", readyBranch, "button"],
            ["pull-request", readyPullRequest, "button"],
            ["pull-request/empty", unpublishedPullRequest, "link"],
          ] as const) {
            await page.goto(url(screen));
            await page.addStyleTag({ content: "html { font-size: 200%; }" });
            expect(await page.evaluate(overlappingChrome), screen).toEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              screen,
            ).toBe(true);
            const reference = page.getByRole(role, { name, exact: true });
            await expect(reference).toBeVisible();
            await expect
              .poll(() => reference.evaluate(referenceTriggerLayout), {
                message: screen + " keeps one label line and a visible chevron",
                timeout: 10_000,
              })
              .toEqual({
                labelLines: 1,
                chevronInsideTrigger: true,
                chevronInsideBar: true,
                chevronClippingAncestors: [],
              });
          }
        },
      );

    test("the top bar composes the cloud slots: " + label, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(url("standalone"));
      const viewer = page.locator(".mokly-viewer");
      await expect(
        viewer.getByRole("button", { name: readyBranch, exact: true }),
      ).toBeVisible();
      // The full bar holds the project switcher, History, Share and the
      // account's avatar, named by the reader; Settings lives in the account
      // menu, not in the bar.
      const labels =
        viewport === "mobile"
          ? ["More"]
          : [
              sample.workspace + " / " + sample.project,
              "History",
              "Share",
              sample.viewer.name,
            ];
      for (const name of labels)
        await expect(
          viewer.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      await expect(
        viewer.getByRole("button", { name: "Settings", exact: true }),
      ).toHaveCount(0);

      if (viewport === "desktop") {
        await page.setViewportSize({ width: 700, height: 900 });
        for (const [screen, name] of [
          ["standalone", readyBranch],
          ["pull-request", readyPullRequest],
        ] as const)
          await test.step("narrow desktop " + screen, async () => {
            await page.goto(url(screen));
            await expect(
              viewer.getByRole("button", { name, exact: true }),
            ).toBeVisible();
            await expect(
              viewer.getByRole("button", { name: "More", exact: true }),
            ).toBeVisible();
            await expect(
              viewer.getByRole("button", { name: "History", exact: true }),
            ).toBeHidden();
          });
      }
    });

    if (viewport === "desktop")
      test(
        "long viewer identities stay inside one top-bar row: " + label,
        async ({ page }) => {
          await page.setViewportSize(size);
          await page.goto(url("standalone", "account"));
          expect(await page.evaluate(topBarViolations)).toEqual([]);
          const viewer = page.locator(".mokly-viewer");
          await expect(
            viewer.getByRole("button", {
              name: denseViewerChrome.workspace + " / " + sample.project,
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            viewer.getByRole("button", {
              name: denseViewerChrome.email,
              exact: true,
            }),
          ).toBeVisible();
        },
      );

    test(
      "a pull request entry names its author: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("pull-request"));
        await expect(
          page.getByRole("button", {
            name: pullRequest.number + " " + pullRequest.title,
          }),
        ).toBeVisible();
        if (viewport === "desktop")
          await expect(
            page.getByRole("button", { name: "GitHub" }),
          ).toBeVisible();
        // The static navigation marks the preselected filter as the current one.
        await expect(page.locator('[data-filter="changed"]')).toHaveAttribute(
          "aria-current",
          "page",
        );
        if (viewport === "desktop") {
          await expect(
            page.getByText(pullRequest.view, { exact: true }).first(),
          ).toBeVisible();
          await expect(
            page.getByText(pullRequest.author, { exact: false }).first(),
          ).toBeVisible();
          await expect(
            page.getByText(pullRequest.sha, { exact: true }),
          ).toBeVisible();
        }
      },
    );
  }
