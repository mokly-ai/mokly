import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import {
  linkRenderer,
  linkSource,
  prepareLinkFixture,
} from "../helpers/component_link_fixture.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";

test("an SVG stylesheet link does not suppress the component CSS", async ({
  page,
}) => {
  const fixture = await createFixture(linkSource, {
    extraConfig: 'renderer: "renderer.tsx", stylesheets: [],',
  });
  try {
    await prepareLinkFixture(
      fixture,
      linkRenderer(
        "''",
        `'<svg><link rel="stylesheet" href="' + '../'.repeat(input.entry.path.split('/').length + 1) + 'action.css"></svg>'`,
      ),
    );
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    await page.goto(
      pathToFileURL(
        path.join(fixture.generatedDir, "checkout/index.mobile.html"),
      ).href,
    );
    expect(
      await page.locator("svg link").evaluate((link) => link.namespaceURI),
    ).toBe("http://www.w3.org/2000/svg");
    expect(
      await page
        .locator(".action")
        .evaluate((button) => getComputedStyle(button).color),
    ).toBe("rgb(255, 0, 0)");
    await expect(page.locator('head > link[rel="stylesheet"]')).toHaveCount(1);
  } finally {
    await removeFixture(fixture);
  }
});
