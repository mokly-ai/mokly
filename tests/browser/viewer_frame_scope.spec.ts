import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type {
  CatalogueReadModel,
  InstanceRef,
  MoklyViewerProps,
} from "@mokly/viewer";

import { test } from "./browser_test.js";
import { followupFixture } from "./viewer_followup_fixture.js";
import type {} from "./viewer_harness.js";
import { chooseVariant } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

async function start(page: Page, cross: boolean, screenPath = "home") {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ cross, screenPath }) => {
      const host = window.viewerHarness.start("one", {
        cross,
        defaultSelection: { screenPath, viewport: "both" },
      });
      const catalogue = structuredClone(host.props.index) as CatalogueReadModel;
      catalogue.screens[0]!.useCasePaths = ["tour"];
      catalogue.useCases = [
        {
          kind: "use-case",
          path: "tour",
          detailId: catalogue.screens[0]!.detailId,

          title: "Tour",
          tags: [],
          details: catalogue.screens[0]!.details,
          changes: catalogue.screens[0]!.changes,
          steps: [
            { screenPath: "home" },
            { screenPath: "home" },
            { screenPath: "home" },
          ],
        },
      ];
      catalogue.tree = [...catalogue.tree, { kind: "entry", path: "tour" }];
      host.props = { ...host.props, index: catalogue } as MoklyViewerProps;
      host.render();
    },
    { cross, screenPath },
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
  const frames = page.locator("iframe[data-mokly-frame-state]");
  for (let i = 0; i < (await frames.count()); i++)
    await expect(frames.nth(i)).toHaveAttribute(
      "data-mokly-frame-state",
      "ready",
    );
  await page.evaluate(
    (instance) =>
      window.viewerHarness.get("one").ref.current.highlightInstance(instance),
    instance,
  );
  await expect(frames.nth(index)).toHaveAccessibleName(
    new RegExp(`— ${instance.viewport}$`),
  );
  const labels = page.locator("[data-mokly-label-layer] button");
  await expect(labels).toHaveCount(1);
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(1);
  await expect(page.locator(".mbk-highlight-layer")).toHaveAttribute(
    "data-highlight-viewport",
    instance.viewport,
  );
  if (cross) {
    const frames = page.locator("iframe[data-mokly-fragment-frame]");
    for (let i = 0; i < (await frames.count()); i++) {
      await expect(
        frames.nth(i).contentFrame().locator("[data-mokly-overlay]"),
      ).toHaveCount(0);
    }
  }
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
          { screenPath: "home", key, viewport, colorScheme },
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
    const component = fixture.index.components.find(
      (entry) => entry.path === "pane",
    )!;
    for (const variant of fixture.index.components.filter(
      (entry) => entry.variantOf === component.path,
    )) {
      await chooseVariant(page, variant.title);
      await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
        0,
      );
      const usage = fixture.details.current[variant.path]!.views.find(
        (view) => view.viewport === "desktop" && view.colorScheme === "light",
      )!.usage;
      if (usage.status !== "ready") throw new Error("Expected ready usage");
      await highlight(
        page,
        {
          screenPath: variant.path,
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
        screenPath: "home",
        key,
        viewport: "desktop" as const,
        colorScheme: "light" as const,
        stepIndex,
      };
      const clicked = await highlight(page, instance, cross, stepIndex);
      expect(clicked).toMatchObject({
        frame: { entryPath: "tour", stepIndex },
      });
    }
  });
}
