import path from "node:path";

import { expect, type Locator } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { test as baseTest } from "./browser_test.js";
import { componentDesignFixture } from "./component_design_fixture.js";
import { designFileUrl as servedDesignFileUrl } from "./design_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";
import { copiedDesignFileUrl } from "./static_test.js";

export function registerDesignStylesheetEvidence(
  test = baseTest,
  mode: "serve" | "static" = "serve",
) {
  const designFileUrl =
    mode === "static" ? copiedDesignFileUrl : servedDesignFileUrl;
  test.beforeEach(({ allowBrowserError, baseURL }) =>
    documentFavicon(allowBrowserError, baseURL!),
  );
  const { componentDesignUrl } = componentDesignFixture(test, designFileUrl);

  /** A shell design artboard opened directly from disk. */
  function shellDesignUrl(id: string, viewport: string): string {
    return designFileUrl(
      path.join(
        repositoryRoot,
        `examples/basic/mokly-generated/${id}/index.${viewport}.html`,
      ),
    ).href;
  }

  /** Top margins of the sentence and style list nested under the first file. */
  function nestedSpacing(files: Locator) {
    return files.evaluate((list) => {
      const item = list.querySelector(":scope > li");
      const margin = (selector: string) => {
        const element = item?.querySelector(selector);
        return element ? getComputedStyle(element).marginTop : "";
      };
      return { sentence: margin(":scope > p"), styles: margin(":scope > ul") };
    });
  }

  for (const viewport of ["desktop", "mobile"] as const) {
    test.describe(`${viewport} stylesheet evidence designs`, () => {
      test.use({
        viewport:
          viewport === "desktop"
            ? { width: 1440, height: 1000 }
            : { width: 390, height: 844 },
      });

      test("each file's sentence and styles sit under it with the card spacing", async ({
        page,
      }) => {
        for (const url of [
          shellDesignUrl(
            "design/changes/impact/styles/matched-excluded/matched",
            viewport,
          ),
          shellDesignUrl("design/changes/impact/styles/page", viewport),
          componentDesignUrl(
            "design/components/states/shared-impact/style-changed",
            viewport,
          ),
          componentDesignUrl(
            "design/components/states/shared-impact/style-outside",
            viewport,
          ),
        ]) {
          await page.goto(url);
          const files = page.locator(".mbk-evidence-files");
          await expect(files, url).toHaveCount(1);
          expect(await nestedSpacing(files), url).toEqual({
            sentence: "8px",
            styles: "8px",
          });
        }
      });

      test("the shared Excluded and Matched card spaces its excluded file with the card spacing", async ({
        page,
      }) => {
        for (const id of [
          "design/changes/impact/styles/matched-excluded/excluded",
          "design/changes/impact/styles/matched-excluded/matched",
        ]) {
          await page.goto(shellDesignUrl(id, viewport));
          const spacing = await page
            .locator(".mbk-comparison-details")
            .evaluate((card) =>
              [
                ...card.querySelectorAll(
                  ":scope .mbk-comparison-evidence > .mbk-evidence-files ~ *",
                ),
              ].map(
                (element) =>
                  `${element.tagName.toLowerCase()} ${getComputedStyle(element).marginTop}`,
              ),
            );
          expect(spacing, id).toEqual(["p 14px", "p 8px", "ul 8px"]);
        }
      });

      test("the page designs open the changed document, which has no comparison controls", async ({
        page,
      }) => {
        await page.goto(
          shellDesignUrl(
            viewport === "desktop"
              ? "design/browse/pages/view"
              : "design/browse/pages/navigation",
            viewport,
          ),
        );
        const filter = page.getByRole("group", { name: "Catalogue filter" });
        await expect(filter).toContainText("Changes5");
        await filter.getByRole("link", { name: /Changes/ }).click();
        await expect(page).toHaveURL(
          shellDesignUrl("design/changes/impact/styles/page", viewport),
        );
        await expect(page.locator(".mbk-diff-toolbar")).toHaveCount(0);
        await expect(page.locator(".mbk-comparison-stage")).toHaveCount(0);
        await expect(page.locator(".mbk-doc-pane")).toContainText("Next steps");
        const evidence = page.locator(".mbk-comparison-details");
        await expect(evidence).toContainText(
          "Changes to these files may affect this page:",
        );
        await expect(
          evidence.locator(".mbk-evidence-files > li > p"),
        ).toHaveText([
          "These changed styles also apply outside the changed components on this page:",
          "Changed styles that apply to this page:",
          "This change can apply anywhere on the page, so the page stays in Changes:",
        ]);
        if (viewport === "desktop") {
          await page
            .getByRole("group", { name: "Catalogue filter" })
            .getByRole("link", { name: "All" })
            .click();
          await expect(page).toHaveURL(
            shellDesignUrl("design/browse/pages/view", viewport),
          );
        }
      });

      test("the outside-styles screen opens Action's own stylesheet story", async ({
        page,
      }) => {
        await page.goto(
          componentDesignUrl(
            "design/components/states/shared-impact/style-outside",
            viewport,
          ),
        );
        const count =
          viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count";
        await expect(page.locator(count)).toHaveText("5");
        const evidence = page.locator("[data-workspace-evidence]");
        await expect(evidence).toContainText(
          "These changed styles also apply outside the changed components on this screen:",
        );
        await expect(
          evidence.getByText("Changed component: Action", { exact: true }),
        ).toHaveCount(1);
        await evidence.getByRole("link", { name: "Action" }).click();
        await expect(page).toHaveURL(
          componentDesignUrl(
            "design/components/states/shared-impact/style-changed",
            viewport,
          ),
        );
        await expect(
          page.locator(".mbk-screen-head .mbk-entry-status"),
        ).toHaveText("Changed");
        await expect(page.locator(count)).toHaveText("4");
        await expect(
          page.locator('[data-usage-section="affected"]').getByRole("link"),
        ).toHaveCount(2);
        await expect(
          page
            .getByRole("navigation", { name: "Saved variants" })
            .getByRole("link"),
        ).toHaveText(["Action"]);
      });

      test("an affected screen opens in its comparison and returns to Action", async ({
        page,
      }) => {
        const story = componentDesignUrl(
          "design/components/states/shared-impact/style-changed",
          viewport,
        );
        await page.goto(story);
        await page
          .locator('[data-usage-section="affected"]')
          .getByRole("link", { name: "Welcome" })
          .click();
        await expect(page).toHaveURL(
          componentDesignUrl(
            "design/components/states/shared-impact/affected-screen",
            viewport,
          ),
        );
        const count =
          viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count";
        await expect(page.locator(count)).toHaveText("4");
        await expect(
          page.locator(".mbk-screen-head .mbk-entry-status"),
        ).toHaveText("Unmodified");
        // Welcome stays out of Changes, yet Action's link opens its comparison.
        const toolbar = page.locator(".mbk-diff-toolbar");
        await expect(toolbar).toHaveCount(1);
        await expect(
          toolbar.getByRole("button", { name: "Side by side", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        const heading = "Components this screen uses changed";
        // The shown view reads the heading over its two versions.
        const stages = page.locator(".mbk-comparison-stage:visible");
        await expect(stages.locator(":scope > h3")).toHaveText([
          `${viewport === "desktop" ? "Desktop" : "Mobile"} · ${heading}`,
        ]);
        for (const stage of await stages.all())
          await expect(stage.locator(".mbk-compare-label")).toHaveText([
            "Before",
            "Current",
          ]);
        const evidence = page.locator("[data-workspace-evidence]");
        await expect(
          evidence.locator(".mbk-evidence-files > li > p"),
        ).toHaveText(["Changed styles that apply to this screen:"]);
        await expect(evidence.locator(":scope > p").last()).toHaveText(
          "Changed components that this screen uses affect its preview.",
        );
        await expect(evidence).not.toContainText("No changes to this screen.");
        await expect(
          evidence.getByText("Changed component: Action", { exact: true }),
        ).toHaveCount(1);
        await evidence.getByRole("link", { name: "Action" }).click();
        await expect(page).toHaveURL(story);
      });
    });
  }
}
