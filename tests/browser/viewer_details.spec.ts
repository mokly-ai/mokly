import { expect, test, type Locator, type Page } from "@playwright/test";

import { readCatalogue } from "@mokly/viewer";
import type { CatalogueReadModel } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import {
  EXAMINED_LEAD,
  EXCLUDED_LEAD,
  INSPECTOR_VIEWPORTS,
  SCREEN_TERMINAL,
  VARIANT_TERMINAL,
  openEvidence,
} from "./css_evidence_page.js";
import type {} from "./viewer_harness.js";

/** The stylesheet that the screen and the saved view examined and excluded. */
const EXCLUDED_PATH = "mockups/styles.css";
/** The excluded-stylesheet sentence of a saved component view. */
const VARIANT_EXCLUDED_LEAD =
  "This stylesheet changed, but none of the changed styles apply to this variant.";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
let catalogue: CatalogueReadModel;

test.beforeAll(async () => {
  fixture = await viewerFixture();
  catalogue = readyCatalogue(fixture.catalogue);
});
test.afterAll(async () => fixture?.close());

type JsonObject = Record<string, unknown>;

/**
 * The harness catalogue as a host receives it once Changes are ready: every
 * entry is unmodified, and the screen and Action's default saved view each
 * examined and excluded one stylesheet. A public catalogue has no branch name.
 */
function readyCatalogue(source: CatalogueReadModel): CatalogueReadModel {
  const ready = (entry: JsonObject): JsonObject => {
    const excluded =
      entry["path"] === "home" || entry["path"] === "action/default";
    const views = entry["views"];
    return {
      ...entry,
      changes: { status: "ready", kind: "unmodified", included: false },
      ...("comparison" in entry
        ? { comparison: { status: "unavailable" } }
        : {}),
      ...(Array.isArray(views)
        ? {
            views: views.map((view: JsonObject) => ({
              ...view,
              comparison: { status: "unavailable" },
              ...(excluded
                ? {
                    resourceEvidence: {
                      excludedResources: [
                        { path: EXCLUDED_PATH, reason: "no-matching-rule" },
                      ],
                    },
                  }
                : {}),
            })),
          }
        : {}),
    };
  };
  const model = JSON.parse(JSON.stringify(source)) as Record<
    "screens" | "pages" | "components" | "useCases",
    JsonObject[]
  >;
  return readCatalogue({
    ...model,
    changesStatus: "ready",
    screens: model.screens.map(ready),
    pages: model.pages.map(ready),
    components: model.components.map(ready),
    useCases: model.useCases.map(ready),
  });
}

/** Mount the public viewer over the ready catalogue and open its Details. */
async function embeddedEvidence(
  page: Page,
  screenPath: string,
): Promise<Locator> {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ source, screenPath }) => {
      window.viewerHarness.start("one", {
        defaultSelection: { screenPath },
        responsive: true,
        source: JSON.parse(source) as unknown,
      });
    },
    { source: JSON.stringify(catalogue), screenPath },
  );
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  return openEvidence(page);
}

for (const [name, size] of INSPECTOR_VIEWPORTS) {
  test.describe(`${name} embedded Details`, () => {
    test.use({ viewport: size });

    test("an embedded screen keeps its Details without the branch-point sentence", async ({
      page,
    }) => {
      const evidence = await embeddedEvidence(page, "home");
      await expect(evidence.locator("h3")).toHaveText(["Comparison details"]);
      await expect(evidence.locator("p")).toHaveText([
        EXCLUDED_LEAD,
        EXAMINED_LEAD,
        SCREEN_TERMINAL,
      ]);
      await expect(evidence.locator("li")).toHaveText([EXCLUDED_PATH]);
    });

    test("an embedded saved view keeps its Details without the branch-point sentence", async ({
      page,
    }) => {
      const evidence = await embeddedEvidence(page, "action/default");
      await expect(evidence.locator("h3")).toHaveText(["Comparison details"]);
      await expect(evidence.locator("p")).toHaveText([
        VARIANT_EXCLUDED_LEAD,
        EXAMINED_LEAD,
        VARIANT_TERMINAL,
      ]);
      await expect(evidence.locator("li")).toHaveText([EXCLUDED_PATH]);
    });
  });
}
