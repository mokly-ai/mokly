import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type {
  CatalogueReadModel,
  InstanceRef,
  MoklyViewerProps,
} from "@mokly/viewer";

import { followupFixture } from "./viewer_followup_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

async function start(page: Page, cross: boolean, screenId = "home") {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ cross, screenId }) => {
      const host = window.viewerHarness.start("one", {
        cross,
        defaultSelection: { screenId, viewport: "both" },
      });
      const catalogue = structuredClone(
        host.props.catalogue,
      ) as CatalogueReadModel;
      catalogue.screens[0]!.useCaseIds = ["tour"];
      catalogue.useCases = [
        {
          kind: "use-case",
          id: "tour",
          title: "Tour",
          route: "flows/tour.html",
          tags: [],
          details: catalogue.screens[0]!.details,
          changes: { status: "disabled" },
          steps: [
            { screenId: "home" },
            { screenId: "home" },
            { screenId: "home" },
          ],
        },
      ];
      catalogue.tree.pages = [
        ...catalogue.tree.pages,
        { kind: "entry", id: "tour" },
      ];
      host.props = { ...host.props, catalogue } as MoklyViewerProps;
      host.render();
    },
    { cross, screenId },
  );
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
}

async function highlight(
  page: Page,
  instance: InstanceRef,
  cross: boolean,
  index: number,
) {
  await page.evaluate(
    (instance) =>
      window.viewerHarness.get("one").ref.current.highlightInstance(instance),
    instance,
  );
  const labels = page.locator("[data-mokly-label-layer] button");
  await expect(labels).toHaveCount(1);
  if (cross) {
    const frames = page.locator("iframe[data-mokly-fragment-frame]");
    for (let i = 0; i < (await frames.count()); i++) {
      await expect(
        frames.nth(i).contentFrame().locator("[data-mokly-overlay]"),
      ).toHaveCount(i === index ? 1 : 0);
    }
  } else await expect(page.locator(".mbk-highlight-layer")).toHaveCount(1);
  await labels.click();
  const clicked = await page.evaluate(
    () =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "click")
        .at(-1)!.value,
  );
  expect(clicked).toMatchObject({ instance });
  return clicked;
}

for (const cross of [false, true]) {
  test(`${cross ? "postMessage" : "same-origin"} flow fragment belongs only to its first frame across schemes`, async ({
    page,
  }) => {
    await start(page, cross);
    const link = page.getByRole("link", { name: "Tour", exact: true });
    await link.evaluate((link) => {
      (link as HTMLAnchorElement).href += "?fragment=example-anchor";
    });
    await link.click();
    for (const scheme of ["light", "dark"] as const) {
      await page.evaluate(
        (colorScheme) =>
          window.viewerHarness.get("one").ref.current.select({ colorScheme }),
        scheme,
      );
      await page.evaluate(async () => {
        await window.viewerHarness.get("one").ref.current.startPick();
        window.viewerHarness.get("one").ref.current.cancelPick();
      });
      const frames = page.locator(".flow-step iframe");
      await expect(frames).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        const frame = await (await frames
          .nth(i)
          .elementHandle())!.contentFrame();
        expect(new URL(frame!.url()).hash).toBe(
          i === 0 ? "#example-anchor" : "",
        );
        for (const attribute of [
          "src",
          "data-fragment-light",
          "data-fragment-dark",
        ]) {
          const source = await frames.nth(i).getAttribute(attribute);
          expect(new URL(source!, fixture.host.url).hash).toBe(
            i === 0 ? "#example-anchor" : "",
          );
        }
      }
    }
  });

  test(`${cross ? "postMessage" : "same-origin"} public highlights retain viewport and scheme scope with Both visible`, async ({
    page,
  }) => {
    await start(page, cross);
    const key = fixture.usage.instances.find(
      (item) => item.id === "action",
    )!.key;
    for (const colorScheme of ["light", "dark"] as const) {
      await page.evaluate(
        (colorScheme) =>
          window.viewerHarness.get("one").ref.current.select({ colorScheme }),
        colorScheme,
      );
      await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
        0,
      );
      for (const [index, viewport] of (
        ["mobile", "desktop"] as const
      ).entries())
        await highlight(
          page,
          { screenId: "home", key, viewport, colorScheme },
          cross,
          index,
        );
    }
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.highlightInstance(null),
    );
    await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
      0,
    );
  });

  test(`${cross ? "postMessage" : "same-origin"} highlights retain saved variant scope`, async ({
    page,
  }) => {
    await start(page, cross, "pane");
    const component = fixture.catalogue.components.find(
      (entry) => entry.id === "pane",
    )!;
    for (const variant of component.variants) {
      await page
        .getByRole("combobox", { name: "Saved variant" })
        .selectOption(variant.id);
      await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
        0,
      );
      const usage = variant.views[0]!.usage;
      if (usage.status !== "ready") throw new Error("Expected ready usage");
      await highlight(
        page,
        {
          screenId: "pane",
          variantId: variant.id,
          key: usage.instances[0]!.key,
          viewport: "desktop",
          colorScheme: "light",
        },
        cross,
        1,
      );
    }
  });

  test(`${cross ? "postMessage" : "same-origin"} highlights and events identify repeated flow steps`, async ({
    page,
  }) => {
    await start(page, cross, "tour");
    const key = fixture.usage.instances.find(
      (item) => item.id === "action",
    )!.key;
    for (const stepIndex of [0, 1, 2]) {
      const instance = {
        screenId: "home",
        key,
        viewport: "desktop" as const,
        colorScheme: "light" as const,
        stepIndex,
      };
      const clicked = await highlight(page, instance, cross, stepIndex);
      expect(clicked).toMatchObject({ frame: { entryId: "tour", stepIndex } });
    }
  });
}
