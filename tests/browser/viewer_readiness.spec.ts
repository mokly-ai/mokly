import { expect } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import type {} from "./viewer_harness.js";
import { canvasFrame } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture({
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
            host.props.index,
          ) as CatalogueReadModel;
          for (const view of host.details["home"]!.views)
            if (view.viewport === "desktop") view.usage = { status };
          host.props.index = catalogue;
          host.render();
        },
        { cross, status },
      );
      await page.waitForFunction(() =>
        Boolean(window.viewerHarness.get("one").ref.current),
      );
      await page.evaluate(async () => {
        const host = window.viewerHarness.get("one");
        const usage = host.details["home"]!.views.find(
          (view) => view.viewport === "mobile",
        )!.usage;
        if (usage.status !== "ready") throw new Error("Expected ready usage");
        await host.ref.current.highlightInstance({
          screenPath: "home",
          viewport: "mobile",
          colorScheme: "light",
          key: usage.instances.find((instance) => instance.id === "action")!
            .key,
        });
        host.events.length = 0;
      });
      const sibling = page.frameLocator(canvasFrame("desktop"));
      await sibling
        .getByRole("button", { name: "Visible", exact: true })
        .hover();
      await sibling
        .getByRole("button", { name: "Visible", exact: true })
        .click();
      // The action screen's frames report hover. A pointer that rests over
      // the canvas when the action document loads under it reports a hover
      // of no instance when the canvas moves that frame. The pointer goes to
      // the page's top-left corner, outside every canvas frame, before the
      // keyboard opens the link.
      await page.mouse.move(0, 0);
      await sibling.getByRole("link", { name: "Open Action" }).press("Enter");
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
            value: expect.objectContaining({ screenPath: "action" }),
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
