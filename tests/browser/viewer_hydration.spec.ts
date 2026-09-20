import { expect, test } from "@playwright/test";

import { viewerHydrationFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerHydrationFixture>>;
test.beforeAll(async () => {
  fixture = await viewerHydrationFixture();
});
test.afterAll(async () => fixture?.close());

test("independent application-owned server roots hydrate in place", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${fixture.host.url}/hydration.html`);
  await page.waitForFunction(() => window.viewerHydrationHarness?.ready());
  for (const rootId of ["hydration-primary", "hydration-secondary"])
    await expect(page.locator(`#${rootId} [data-mokly-nav]`)).toHaveAttribute(
      "data-resize-ready",
      "",
    );

  const result = await page.evaluate(() => {
    const roots = ["hydration-primary", "hydration-secondary"].map((rootId) => {
      const root = document.getElementById(rootId)!;
      const ids = [...root.querySelectorAll<HTMLElement>("[id]")].map(
        ({ id }) => id,
      );
      const references = [
        ...root.querySelectorAll<HTMLElement>(
          '[aria-controls], [aria-describedby], [aria-labelledby], [for], [href^="#"]',
        ),
      ].flatMap((element) =>
        [
          "aria-controls",
          "aria-describedby",
          "aria-labelledby",
          "for",
          "href",
        ].flatMap((attribute) => {
          const value = element.getAttribute(attribute);
          return value ? value.replace(/^#/, "").split(" ") : [];
        }),
      );
      return { ids, references, rootId };
    });
    const allIds = roots.flatMap(({ ids }) => ids);
    return {
      errors: window.viewerHydrationHarness.recoverableErrors,
      isolated: roots.every(({ ids, references, rootId }) => {
        const viewerId = rootId.replace("hydration-", "");
        const localIds = new Set(ids);
        return (
          ids.every((id) => id.startsWith(`mokly-${viewerId}-`)) &&
          references.every((id) => localIds.has(id))
        );
      }),
      retained: window.viewerHydrationHarness.retained(),
      unique: new Set(allIds).size === allIds.length,
    };
  });
  expect(result).toEqual({
    errors: [],
    isolated: true,
    retained: {
      "hydration-primary": { frame: true, shell: true },
      "hydration-secondary": { frame: true, shell: true },
    },
    unique: true,
  });
  expect(pageErrors).toEqual([]);
  expect(
    consoleErrors.filter((message) =>
      /hydration|server rendered|client rendered/i.test(message),
    ),
  ).toEqual([]);
});
