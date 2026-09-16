import { expect, test } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture("", {
    body: '<action.Component label="Visible" /><MockLink to="action">Open Action</MockLink>',
  });
});
test.afterAll(async () => fixture?.close());

for (const cross of [false, true]) {
  for (const status of ["pending", "unavailable"] as const) {
    test(`${cross ? "postMessage" : "same-origin"} ${status} sibling keeps navigation without automatic inspection`, async ({
      page,
    }) => {
      await page.goto(fixture.host.url);
      await page.waitForFunction(() => Boolean(window.viewerHarness));
      await page.evaluate(
        ({ cross, status }) => {
          const host = window.viewerHarness.start("one", {
            cross,
            defaultSelection: { viewport: "both" },
          });
          const catalogue = structuredClone(
            host.props.catalogue,
          ) as CatalogueReadModel;
          for (const view of catalogue.screens[0]!.views)
            if (view.viewport === "desktop") view.usage = { status };
          host.props.catalogue = catalogue;
          host.render();
        },
        { cross, status },
      );
      await page.waitForFunction(() =>
        Boolean(window.viewerHarness.get("one").ref.current),
      );
      await page.evaluate(async () => {
        const host = window.viewerHarness.get("one");
        const catalogue = host.props.catalogue as CatalogueReadModel;
        const usage = catalogue.screens[0]!.views.find(
          (view) => view.viewport === "mobile",
        )!.usage;
        if (usage.status !== "ready") throw new Error("Expected ready usage");
        await host.ref.current.highlightInstance({
          screenId: "home",
          viewport: "mobile",
          colorScheme: "light",
          key: usage.instances.find((instance) => instance.id === "action")!
            .key,
        });
        host.events.length = 0;
      });
      const sibling = page.frameLocator(
        'iframe[data-workspace-frame="desktop"]',
      );
      await sibling
        .getByRole("button", { name: "Visible", exact: true })
        .hover();
      await sibling
        .getByRole("button", { name: "Visible", exact: true })
        .click();
      await sibling.getByRole("link", { name: "Open Action" }).click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.viewerHarness
              .get("one")
              .events.filter((event) => event.name === "navigate"),
          ),
        )
        .toEqual([
          {
            name: "navigate",
            value: expect.objectContaining({ screenId: "action" }),
          },
        ]);
      expect(
        await page.evaluate(() =>
          window.viewerHarness
            .get("one")
            .events.filter((event) =>
              ["error", "hover", "click"].includes(event.name),
            ),
        ),
      ).toEqual([]);
    });
  }
}
