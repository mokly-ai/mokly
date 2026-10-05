import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  branchCatalogue,
  startBranchHost,
  type BranchHost,
} from "./branch_hosts.js";

const config = (schemes: string) =>
  `{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:${schemes}}`;
const screen = (title: string) =>
  `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'${title}',description:'${title}',dependencies:[],relatedDocs:[],mobile:<main><h1>${title}</h1></main>,desktop:<main><h1>${title}</h1></main>});`;
const TERMS = `---
description: When an invoice is due.
---
# Payment terms

Every invoice is due 30 days after it is issued.
`;

/**
 * A catalogue that rendered Light and Dark at the branch point and renders
 * Light only now. Its removed Legacy screen keeps a dark render, so the shell
 * still offers Dark, while the current Payment terms document has a light
 * page only.
 */
function lightOnlyCatalogue() {
  return branchCatalogue(
    {
      "specs/home.mockup.tsx": screen("Home"),
      "specs/legacy.mockup.tsx": screen("Legacy"),
      "specs/payment-terms.md": TERMS,
    },
    config('["light","dark"]'),
    async (fixture) => {
      await fixture.write(
        "mokly.config.ts",
        `export default ${config('["light"]')};`,
      );
      await fs.rm(path.join(fixture.root, "specs/legacy.mockup.tsx"));
    },
  );
}

for (const kind of ["serve", "export"] as const)
  test.describe(kind, () => {
    let host: BranchHost;

    test.beforeAll(async () => {
      test.setTimeout(180_000);
      host = await startBranchHost(kind, lightOnlyCatalogue);
    });

    test.afterAll(async () => {
      if (host) await host.close();
    });

    for (const width of [1280, 390])
      test(`${width}px: a current light-only document names its light page in a band under Dark`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await host.open(page, "payment-terms");
        const band = page.locator(".mbk-previous.mbk-scheme-fallback");
        await expect(band).toHaveCount(1);
        await expect(band).toBeHidden();
        await page
          .locator("[data-mokly-appearance-select]")
          .selectOption("dark");
        await expect(band).toBeVisible();
        await expect(band).toHaveText("Light only");
        expect(
          await band.evaluate((element) => {
            const style = getComputedStyle(element);
            const note = element.querySelector(".mbk-frame-scheme-note");
            const muted = document.createElement("span");
            muted.style.color = "var(--chrome-muted)";
            element.append(muted);
            const expectedColor = getComputedStyle(muted).color;
            muted.remove();
            return {
              borderBottom: `${style.borderBottomWidth} ${style.borderBottomStyle}`,
              color: style.color === expectedColor,
              fontSize: style.fontSize,
              noteDisplay: note ? getComputedStyle(note).display : null,
              noteWeight: note ? getComputedStyle(note).fontWeight : null,
              padding: style.padding,
            };
          }),
        ).toEqual({
          borderBottom: "1px solid",
          color: true,
          fontSize: "11.5px",
          noteDisplay: "inline",
          noteWeight: "500",
          padding: width > 760 ? "8px 24px" : "8px 16px",
        });
        const pane = page.locator("[data-mokly-fragment-frame]");
        await expect(pane).toHaveAttribute(
          "src",
          /\/static\/payment-terms\/index\.html$/u,
        );
        const bandBox = await band.boundingBox();
        const paneBox = await pane.boundingBox();
        expect(bandBox && paneBox && bandBox.y < paneBox.y).toBe(true);
      });
  });
