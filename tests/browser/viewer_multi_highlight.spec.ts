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

async function openViewer(
  page: Page,
  cross: boolean,
  selection: Partial<{
    screenId: string;
    viewport: "mobile" | "desktop" | "both";
    colorScheme: "light" | "dark";
  }> = {},
) {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    ({ cross, selection }) =>
      window.viewerHarness.start("one", {
        cross,
        defaultSelection: {
          screenId: "home",
          viewport: "both",
          ...selection,
        },
      }),
    { cross, selection },
  );
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
}

function homeInstance(
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
): InstanceRef {
  const screen = fixture.catalogue.screens.find(
    (entry) => entry.id === "home",
  )!;
  const view = screen.views.find(
    (candidate) =>
      candidate.viewport === viewport && candidate.colorScheme === colorScheme,
  )!;
  if (view.usage.status !== "ready") throw new Error("Expected ready usage");
  return {
    screenId: screen.id,
    viewport,
    colorScheme,
    key: view.usage.instances.find((instance) => instance.id === "action")!.key,
  };
}

async function expectPresentation(
  page: Page,
  cross: boolean,
  selectedFrames: readonly number[],
) {
  await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
    selectedFrames.length,
  );
  if (!cross) {
    await expect(page.locator(".mbk-highlight-layer")).toHaveCount(
      selectedFrames.length,
    );
    return;
  }
  const frames = page.locator("iframe[data-mokly-frame-state]");
  for (let index = 0; index < (await frames.count()); index++)
    await expect(
      frames.nth(index).contentFrame().locator("[data-mokly-overlay]"),
    ).toHaveCount(selectedFrames.includes(index) ? 1 : 0);
}

for (const cross of [false, true]) {
  const adapter = cross ? "postMessage" : "same-origin";

  test(`${adapter} highlights Both and clears every frame`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const refs = [
      homeInstance("mobile", "light"),
      homeInstance("desktop", "light"),
    ];
    await page.evaluate(
      (refs) =>
        window.viewerHarness.get("one").ref.current.highlightInstances(refs),
      refs,
    );
    await expectPresentation(page, cross, [0, 1]);
    await page.evaluate(() =>
      window.viewerHarness.get("one").ref.current.highlightInstances([]),
    );
    await expectPresentation(page, cross, []);
  });

  test(`${adapter} partitions one highlight across repeated flow steps`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const refs = await page.evaluate(() => {
      const host = window.viewerHarness.get("one");
      const model = structuredClone(host.props.catalogue) as CatalogueReadModel;
      const home = model.screens.find((entry) => entry.id === "home")!;
      home.useCaseIds = ["tour"];
      model.useCases = [
        {
          kind: "use-case",
          id: "tour",
          navPath: [],
          title: "Tour",
          route: "flows/tour.html",
          tags: [],
          details: home.details,
          changes: { status: "disabled" },
          steps: [{ screenId: "home" }, { screenId: "home" }],
        },
      ];
      model.tree.pages = [...model.tree.pages, { kind: "entry", id: "tour" }];
      const view = home.views.find(
        (candidate) =>
          candidate.viewport === "desktop" && candidate.colorScheme === "light",
      )!;
      if (view.usage.status !== "ready")
        throw new Error("Expected ready usage");
      const key = view.usage.instances.find(
        (instance) => instance.id === "action",
      )!.key;
      host.props = {
        ...host.props,
        catalogue: model,
        defaultSelection: { screenId: "tour", viewport: "both" },
      } as MoklyViewerProps;
      host.render();
      return [0, 1].map((stepIndex): InstanceRef => ({
        screenId: "home",
        stepIndex,
        viewport: "desktop",
        colorScheme: "light",
        key,
      }));
    });
    await page.evaluate(
      (refs) =>
        window.viewerHarness.get("one").ref.current.highlightInstances(refs),
      refs,
    );
    await expectPresentation(page, cross, [0, 1]);
  });

  test(`${adapter} rejects a mixed-scheme ref without changing the prior highlight`, async ({
    page,
  }) => {
    await openViewer(page, cross);
    const refs = [
      homeInstance("mobile", "light"),
      homeInstance("desktop", "light"),
    ];
    await page.evaluate(
      (refs) =>
        window.viewerHarness.get("one").ref.current.highlightInstances(refs),
      refs,
    );
    await expectPresentation(page, cross, [0, 1]);
    const mismatched = homeInstance("desktop", "dark");
    const outcome = await page.evaluate(
      async ({ refs, mismatched }) => {
        try {
          await window.viewerHarness
            .get("one")
            .ref.current.highlightInstances([...refs, mismatched]);
          return "resolved";
        } catch {
          return "rejected";
        }
      },
      { refs, mismatched },
    );
    expect(outcome).toBe("rejected");
    await expectPresentation(page, cross, [0, 1]);
    expect(
      await page.evaluate(() =>
        window.viewerHarness
          .get("one")
          .events.filter((event) => event.name === "error"),
      ),
    ).toHaveLength(1);
  });
}
