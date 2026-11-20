import { pathToFileURL } from "node:url";

import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

import { drawings } from "./build-drawings";
import { screenFile } from "./catalogue-paths";
import { rgb } from "./color-metrics";
import { publishCards } from "./stage-drawings";
import { viewerDocumentViolations } from "./viewer-document-policy";
import { accentFills, focusOutline, refusalLayout } from "./viewer-measures";

/**
 * The pages whose stage holds a build card, from the build folder and beyond:
 * every build drawing, which `build-drawings.ts` lists with what each draws.
 */
const buildCards: readonly string[] = drawings.map(({ path }) => path);

/**
 * Every other page the reference stage order adds: the build address's own
 * states, the publishing cards, and the closed, fork and Team cards a pull
 * request alias shows.
 */
const buildStages = [
  "product/viewer/standalone/build/loading",
  "product/viewer/standalone/build/error",
  "product/viewer/standalone/build/unreadable",
  "product/viewer/standalone/publish",
  "product/viewer/standalone/publish/pull-request",
  "product/viewer/standalone/publish/reader",
  "product/viewer/standalone/publish/reader-pull-request",
  "product/viewer/standalone/publish-refused",
  "product/viewer/standalone/publish-refused/pull-request",
  "product/viewer/standalone/publish-busy",
  "product/viewer/pull-request/closed",
  "product/viewer/pull-request/closed/merged",
  "product/viewer/pull-request/fork",
  "product/viewer/pull-request/plan",
  "product/viewer/pull-request/plan/reader",
] as const;

/**
 * Every refused request the stage draws, the card that holds it, and whether
 * the card offers the CI setup guide beside its control. A refusal never adds
 * the guide; the publishing card keeps its own.
 */
const refusedRequests = [
  ...drawings
    .filter(({ refusal }) => refusal)
    .map(({ path }) => ({ path, card: ".fo-build", guide: false })),
  ...publishCards
    .filter(({ cause }) => cause)
    .map(({ path }) => ({ path, card: ".fo-state", guide: true })),
];

for (const viewport of ["desktop", "mobile"] as const)
  for (const scheme of ["light", "dark"] as const) {
    const label = viewport + " " + scheme;
    const size = {
      width: viewport === "mobile" ? 390 : 1440,
      height: viewport === "mobile" ? 844 : 900,
    };

    test(
      "every build stage keeps one action and opens on its newest line: " +
        label,
      async ({ page }) => {
        await page.setViewportSize(size);
        const fill = rgb(tokens.color[scheme].accentSolid);
        for (const id of [...buildCards, ...buildStages]) {
          await page.goto(pathToFileURL(screenFile(id, viewport, scheme)).href);
          expect(await page.evaluate(viewerDocumentViolations), id).toEqual([]);
          await expect(page.locator(".fo-build"), id).toHaveCount(
            buildCards.includes(id) ? 1 : 0,
          );
          const primaries = await page
            .getByTestId("firna-button-primary")
            .count();
          expect(primaries, id).toBeLessThanOrEqual(1);
          expect(await page.evaluate(accentFills, fill), id).toBe(primaries);
          const log = page.locator(".fo-build-log");
          if ((await log.count()) === 0) continue;
          expect(
            await log.evaluate((node) => {
              const last = node.querySelector(".fo-build-lines > :last-child");
              const box = node.getBoundingClientRect();
              const line = last?.getBoundingClientRect();
              return (
                line !== undefined &&
                line.bottom <= box.bottom + 1 &&
                line.top >= box.top - 1
              );
            }),
            id + " shows its newest line",
          ).toBe(true);
        }
        if (viewport !== "mobile") return;
        await page.setViewportSize({ width: 320, height: 844 });
        for (const id of [...buildCards, ...buildStages]) {
          await page.goto(pathToFileURL(screenFile(id, viewport, scheme)).href);
          await page.addStyleTag({ content: "html { font-size: 200%; }" });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            id + " at 320px",
          ).toBe(true);
        }
      },
    );

    test(
      "a build card announces only its title and line, with its reference between them: " +
        label,
      async ({ page }) => {
        await page.setViewportSize(size);
        for (const drawing of drawings) {
          const id = drawing.path;
          await page.goto(pathToFileURL(screenFile(id, viewport, scheme)).href);
          const card = page.locator(".fo-build");
          const failed =
            drawing.build.state === "failed" ||
            drawing.build.state === "timed-out";
          // A refused request is an alert of its own, beside the control.
          await expect(card.getByRole("alert"), id).toHaveCount(
            (failed ? 1 : 0) + (drawing.refusal ? 1 : 0),
          );
          const alert = card.locator(".fo-build-message[role=alert]");
          await expect(alert, id).toHaveCount(failed ? 1 : 0);
          if (failed) {
            await expect(alert.locator(":scope > *"), id).toHaveText(
              drawing.line ? [drawing.title, drawing.line] : [drawing.title],
            );
            await expect(
              alert.locator(".fo-build-reference, a, button, [role=button]"),
              id,
            ).toHaveCount(0);
          }
          if (drawing.refusal)
            await expect(
              card.locator(".fo-build-action [role=alert]"),
              id,
            ).toHaveText(drawing.refusal.cause);
          // The reference reads after the message and still sits between the
          // title and the line, one space step from each, as it always has.
          const layout = await card
            .locator(".fo-build-summary")
            .evaluate((summary) => {
              const box = (selector: string) =>
                summary.querySelector(selector)?.getBoundingClientRect();
              const title = box(".fo-state-title");
              const reference = box(".fo-build-reference");
              const line = box(".fo-build-line");
              const step =
                Number.parseFloat(
                  getComputedStyle(document.documentElement).fontSize,
                ) * 0.25;
              if (!title || !reference) return ["missing title or reference"];
              const problems: string[] = [];
              const near = (a: number, b: number) => Math.abs(a - b) <= 1;
              if (!near(reference.top - title.bottom, step))
                problems.push("reference is not one step below the title");
              if (!near(reference.left, title.left))
                problems.push("reference is not aligned with the title");
              const last = line ?? reference;
              if (line && !near(line.top - reference.bottom, step))
                problems.push("line is not one step below the reference");
              if (line && !near(line.left, title.left))
                problems.push("line is not aligned with the title");
              if (!near(summary.getBoundingClientRect().bottom, last.bottom))
                problems.push("the summary keeps space beneath its last row");
              return problems;
            });
          expect(layout, id).toEqual([]);
        }
      },
    );

    test(
      "a refused request keeps its refusal and guide inside the card: " + label,
      async ({ page }) => {
        const sizes =
          viewport === "mobile"
            ? [
                { width: 390, height: 844, enlarged: false },
                { width: 320, height: 844, enlarged: true },
              ]
            : [{ ...size, enlarged: false }];
        for (const request of refusedRequests)
          for (const { enlarged, ...at } of sizes) {
            const where = request.path + " " + at.width + "px";
            await page.setViewportSize(at);
            await page.goto(
              pathToFileURL(screenFile(request.path, viewport, scheme)).href,
            );
            if (enlarged)
              await page.addStyleTag({ content: "html { font-size: 200%; }" });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              where,
            ).toBe(true);
            const layout = await page
              .locator(request.card)
              .evaluate(refusalLayout);
            expect(layout.outside, where).toEqual([]);
            expect(layout.order, where).toEqual([
              "refusal above the control",
              "control above the reference",
            ]);
            // The guide is read after the control and before the reference:
            // beside the control while the row holds both, beneath it once
            // the row runs out, as it does with enlarged text.
            if (!request.guide) expect(layout.guide, where).toBe("none");
            else if (enlarged)
              expect(layout.guide, where).toBe("beneath the control");
            else if (viewport === "desktop")
              expect(layout.guide, where).toBe("beside the control");
            else
              expect(["beside the control", "beneath the control"]).toContain(
                layout.guide,
              );
          }
      },
    );

    test(
      "a build card's title and output draw the shared focus outline: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        const focus = rgb(tokens.color[scheme].focus);
        const outline = {
          style: "solid",
          width: "2px",
          color: focus,
          offset: "3px",
        };
        // Cancel replaces the card and moves focus to its title, a focus
        // target out of the tab order in the drawing as in the application.
        await page.goto(
          pathToFileURL(
            screenFile(
              "product/viewer/standalone/build/superseded/cancelled",
              viewport,
              scheme,
            ),
          ).href,
        );
        const title = page.locator(".fo-build .fo-state-title");
        await expect(title).toHaveAttribute("tabindex", "-1");
        await page.keyboard.press("Tab");
        await title.focus();
        expect(await title.evaluate(focusOutline)).toEqual({
          ...outline,
          radius: tokens.radius.tight,
          hugsText: true,
        });
        // The output box is a region named by its label, which a keyboard
        // reader reaches with Tab; it keeps its own radius under the outline.
        const output = page.getByRole("region", { name: "Output" });
        await expect(output).toHaveAttribute("tabindex", "0");
        await output.focus();
        expect(await output.evaluate(focusOutline)).toMatchObject({
          ...outline,
          radius: tokens.radius.medium,
        });
        // The rule is shared: a stage card's title given the same focus
        // target draws the same outline.
        await page.goto(
          pathToFileURL(
            screenFile("product/viewer/pull-request/closed", viewport, scheme),
          ).href,
        );
        const other = page.locator(".fo-stage-card .fo-state-title");
        await other.evaluate((node) => node.setAttribute("tabindex", "-1"));
        await page.keyboard.press("Tab");
        await other.focus();
        expect(await other.evaluate(focusOutline)).toMatchObject(outline);
      },
    );
  }
