import { expect } from "@playwright/test";

import { test } from "./browser_test.js";
import { serveCatalogue } from "./catalogue_fixture.js";
import { documentFavicon } from "./document_error_allowance.js";

let fixture: Awaited<ReturnType<typeof serveCatalogue>>;
test.beforeEach(({ allowBrowserError }) => {
  documentFavicon(allowBrowserError, fixture.url);
});
test.beforeAll(async () => {
  fixture = await serveCatalogue(
    {
      "specs/action.mockup.tsx": `import React from "react";
import {defineComponent} from "@mokly/mokly";
export default defineComponent({title: "Action", description: "", relatedDocs: [], propSchema: {type: "object", properties: {}, additionalProperties: false}, props: {}, stylesheets: ["action.css"], render: () => <><svg><link rel="stylesheet" href="../styles/action.css" /></svg><button className="action">Continue</button></>});`,
      "action.css": ".action {color: rgb(10, 20, 30)}",
    },
    {
      stylesheets: [
        { match: "**/*.html", stylesheets: ["$componentStylesheets"] },
      ],
    },
  );
});
test.afterAll(async () => fixture?.close());

test("an SVG stylesheet link does not suppress the component CSS", async ({
  page,
}) => {
  await page.goto(
    `${fixture.url}/static/mokly-generated/action/index.mobile.html`,
  );
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCSS(
    "color",
    "rgb(10, 20, 30)",
  );
  expect(
    await page.locator("svg link").evaluate((link) => link.namespaceURI),
  ).toBe("http://www.w3.org/2000/svg");
  await expect(page.locator('head link[rel="stylesheet"]')).toHaveCount(1);
});
