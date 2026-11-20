import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { tokens } from "@mokly-cloud/tokens/tokens";
import { expect, test } from "@playwright/test";

import { invitationContent, signInContent } from "../fixtures/emails";
import { siteOrigin } from "../fixtures/site";

const root = resolve(import.meta.dirname, "../../../..");
const templates = resolve(root, "crates/mkc-email-templates/templates");
const output = resolve(root, ".context/email-smoke");

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

for (const [kind, content] of [
  ["sign-in", signInContent],
  ["invitation", invitationContent],
] as const) {
  for (const scheme of ["light", "dark"] as const) {
    for (const width of [390, 1440] as const) {
      test(`hosted ${kind} document at ${width}px in ${scheme}`, async ({
        page,
      }) => {
        const values: Record<string, string> = { ...content, siteOrigin };
        const source = readFileSync(resolve(templates, `${kind}.html`), "utf8");
        const html = source.replace(
          /\{\{([a-zA-Z]+)\}\}/g,
          (_, name: string) => {
            expect(values).toHaveProperty(name);
            return escapeHtml(values[name]);
          },
        );
        expect(html).not.toContain("{{");
        mkdirSync(output, { recursive: true });
        const stem = `${kind}-${scheme}-${width}`;
        const path = resolve(output, `${stem}.html`);
        writeFileSync(path, html);

        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        await page.emulateMedia({ colorScheme: scheme });
        await page.route(`${siteOrigin}/brand/*`, async (route) => {
          const filename = route.request().url().split("/").pop();
          if (
            filename !== "mokly-logo-light.png" &&
            filename !== "mokly-logo-dark.png"
          ) {
            await route.abort();
            return;
          }
          await route.fulfill({
            body: readFileSync(
              resolve(root, "apps/site/public/brand", filename),
            ),
            contentType: "image/png",
          });
        });
        await page.goto(pathToFileURL(path).href);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const expectedColor = await page.evaluate((color) => {
          const element = document.createElement("div");
          element.style.backgroundColor = color;
          document.body.append(element);
          const result = getComputedStyle(element).backgroundColor;
          element.remove();
          return result;
        }, tokens.color[scheme].accentSolid);
        await expect(page.locator(".e-action-fill")).toHaveCSS(
          "background-color",
          expectedColor,
        );
        await page.screenshot({
          path: resolve(output, `${stem}.png`),
          fullPage: true,
        });
      });
    }
  }
}
