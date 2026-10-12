import fs from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { exportCatalogue } from "../../dist/export/run.js";
import { componentEntrySource } from "../helpers/component_fixture.js";
import { createExportFixture } from "../helpers/export_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import {
  INSPECTOR_VIEWPORTS,
  openCatalogue,
  openEvidence,
} from "./css_evidence_page.js";

/** The export compares with the fixture's default review base. */
const SENTENCE = "Compared with the branch point on origin/main.";
/** Only the destination's inert workspace links the changed component. */
const LOADED = "Changed component: Action";
const DESTINATION = "/view/home/";

let fixture: Awaited<ReturnType<typeof createExportFixture>>;
let server: Awaited<ReturnType<typeof serveStaticFiles>>;

test.beforeAll(async () => {
  test.setTimeout(90_000);
  const source = componentEntrySource();
  fixture = await createExportFixture(source);
  await fs.writeFile(
    fixture.entryPath,
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  await exportCatalogue(fixture.config, { outDir: "site" });
  server = await serveStaticFiles(fixture.output);
});

test.afterAll(async () => {
  await server?.close();
  await fixture?.close();
});

/**
 * Record the first Details paragraph after every DOM change on the
 * destination route, so a sentence that leaves and returns is seen.
 */
async function recordFirstParagraphs(page: Page): Promise<void> {
  await page.evaluate((destination) => {
    const seen: (string | null)[] = [];
    Object.assign(window, { firstParagraphs: seen });
    new MutationObserver(() => {
      if (location.pathname !== destination) return;
      const evidence = document.querySelector("[data-workspace-evidence]");
      if (!evidence || evidence.hasAttribute("hidden")) return;
      seen.push(evidence.querySelector("p")?.textContent ?? null);
    }).observe(document, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  }, DESTINATION);
}

async function firstParagraphs(page: Page): Promise<(string | null)[]> {
  return page.evaluate(
    () =>
      (window as unknown as { firstParagraphs: (string | null)[] })
        .firstParagraphs,
  );
}

for (const [name, size] of INSPECTOR_VIEWPORTS)
  test.describe(`${name} exported navigation`, () => {
    test.use({ viewport: size });

    test("the temporary view keeps the export's branch name until the screen loads", async ({
      page,
    }) => {
      let reads = 0;
      let release = (): void => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(`**${DESTINATION}`, async (route) => {
        reads++;
        await held;
        await route.continue();
      });

      await page.goto(`${server.url}/view/action/`);
      await expect(page.locator("html")).toHaveAttribute(
        "data-mokly-hydrated",
        "",
      );
      const origin = await openEvidence(page);
      await expect(origin.locator("p").first()).toHaveText(SENTENCE);
      await recordFirstParagraphs(page);

      await openCatalogue(page, name);
      await page.locator('a[data-route="home/index.html"]').click();
      await expect(page).toHaveURL(`${server.url}${DESTINATION}`);
      await expect.poll(() => reads).toBe(1);
      const temporary = await openEvidence(page);
      await expect(temporary).not.toContainText(LOADED);
      await expect(temporary.locator("p").first()).toHaveText(SENTENCE);

      release();
      await expect(temporary.getByText(LOADED, { exact: true })).toBeVisible();
      await expect(temporary.locator("p").first()).toHaveText(SENTENCE);
      expect(reads).toBe(1);
      const recorded = await firstParagraphs(page);
      expect(recorded.length).toBeGreaterThan(0);
      expect([...new Set(recorded)]).toEqual([SENTENCE]);
    });
  });
