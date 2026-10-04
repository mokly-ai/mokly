import { expect, test } from "@playwright/test";

import type { CatalogueReadModel, MoklyViewerProps } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture.close();
});

for (const source of ["object", "fetcher", "url"] as const)
  test(`the embedded ${source} loader reports a typed version failure`, async ({
    page,
  }) => {
    await page.goto(fixture.host.url);
    await page.waitForFunction(() => Boolean(window.viewerHarness));
    await page.route("**/old-catalogue.json", (route) =>
      route.fulfill({ json: { schemaVersion: 3 } }),
    );
    await page.evaluate((source) => {
      const host = window.viewerHarness.start("one");
      const catalogue = { schemaVersion: 3 } as unknown as CatalogueReadModel;
      if (source === "object")
        host.props = { ...host.props, catalogue, baseUrl: location.origin };
      else {
        host.props = {
          ...host.props,
          catalogue:
            source === "url"
              ? new URL("/old-catalogue.json", location.href)
              : async () => ({ catalogue, url: new URL(location.href) }),
        } as MoklyViewerProps;
        delete host.props.baseUrl;
      }
      host.render();
    }, source);
    const message =
      "This catalogue needs a compatible Mokly viewer. Update the viewer and reload.";
    await expect(page.getByRole("alert")).toContainText(message);
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "error")
          .map((event) => event.value),
      ),
    ).toEqual([
      {
        code: "version",
        message,
        details:
          "Unsupported Mokly catalogue version 3; this viewer supports version 4.",
      },
    ]);
    await expect(page.locator("#one iframe")).toHaveCount(0);
  });
