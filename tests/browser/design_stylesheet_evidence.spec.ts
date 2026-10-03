import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Locator } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { componentDesignUrl } from "./component_design_fixture.js";

/** A shell design artboard opened directly from disk. */
function shellDesignUrl(id: string, viewport: string): string {
  return pathToFileURL(
    path.join(
      repositoryRoot,
      `examples/basic/generated/screens/${id}.${viewport}.html`,
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
        shellDesignUrl("design-review-style-matched", viewport),
        componentDesignUrl("design-component-style-changed", viewport),
        componentDesignUrl("design-component-style-outside", viewport),
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

    test("the outside-styles screen opens Action's own stylesheet story", async ({
      page,
    }) => {
      await page.goto(
        componentDesignUrl("design-component-style-outside", viewport),
      );
      const count =
        viewport === "desktop" ? ".mbk-nav-filter-count" : ".ce-change-count";
      await expect(page.locator(count)).toHaveText("5");
      const evidence = page.locator(".ce-comparison-evidence");
      await expect(evidence).toContainText(
        "These changed styles also apply outside the changed components on this screen:",
      );
      await evidence.getByRole("link", { name: "Action" }).click();
      await expect(page).toHaveURL(
        componentDesignUrl("design-component-style-changed", viewport),
      );
      await expect(
        page.locator(".mbk-screen-head .ce-change-status"),
      ).toHaveText("Changed");
      await expect(page.locator(count)).toHaveText("4");
      await expect(
        page
          .getByRole("region", { name: "Affected screens", exact: true })
          .getByRole("link"),
      ).toHaveCount(2);
      await expect(
        page
          .getByRole("navigation", { name: "Saved variants" })
          .getByRole("link"),
      ).toHaveText(["Default"]);
    });
  });
}
