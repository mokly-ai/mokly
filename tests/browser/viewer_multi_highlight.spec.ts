import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type {
  CatalogueReadModel,
  InstanceRef,
  MoklyViewerProps,
} from "@mokly/viewer";

import { test } from "./browser_test.js";
import { useCaseSteps } from "./use_case_steps.js";
import { followupFixture } from "./viewer_followup_fixture.js";
import type {} from "./viewer_harness.js";
import { NARROW_WINDOW } from "./workspace_actions.js";

let fixture: Awaited<ReturnType<typeof followupFixture>>;
test.beforeAll(async () => {
  fixture = await followupFixture();
});
test.afterAll(async () => fixture?.close());

async function openViewer(
  page: Page,
  selection: Partial<{
    screenPath: string;
    viewport: "mobile" | "desktop" | "both";
    colorScheme: "light" | "dark";
  }> = {},
) {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(
    (selection) =>
      window.viewerHarness.start("one", {
        defaultSelection: {
          screenPath: "home",
          viewport: "both",
          ...selection,
        },
      }),
    selection,
  );
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
}

function homeInstance(
  viewport: "mobile" | "desktop",
  colorScheme: "light" | "dark",
): InstanceRef {
  const screen = fixture.details.current["home"]!;
  const view = screen.views.find(
    (candidate) =>
      candidate.viewport === viewport && candidate.colorScheme === colorScheme,
  )!;
  if (view.usage.status !== "ready") throw new Error("Expected ready usage");
  return {
    screenPath: screen.entry.path,
    viewport,
    colorScheme,
    key: view.usage.instances.find((instance) => instance.id === "action")!.key,
  };
}

async function expectPresentation(
  page: Page,
  selectedFrames: readonly number[],
) {
  await expect(page.locator("[data-mokly-label-layer] button")).toHaveCount(
    selectedFrames.length,
  );
  await expect(page.locator(".mbk-highlight-layer")).toHaveCount(
    selectedFrames.length,
  );
}

// The viewer matches the frames and draws the labels, so these cases run on
// one adapter. The adapters have their own specs.
test("same-origin highlights Both and clears every frame", async ({ page }) => {
  await openViewer(page);
  const refs = [
    homeInstance("mobile", "light"),
    homeInstance("desktop", "light"),
  ];
  await page.waitForFunction(
    () => window.viewerHarness.get("one").ref.current !== null,
  );
  await page.evaluate(
    (refs) =>
      window.viewerHarness.get("one").ref.current.highlightInstances(refs),
    refs,
  );
  await expectPresentation(page, [0, 1]);
  await page.evaluate(() =>
    window.viewerHarness.get("one").ref.current.highlightInstances([]),
  );
  await expectPresentation(page, []);
});

test("same-origin partitions one highlight across repeated flow steps", async ({
  page,
}) => {
  await openViewer(page);
  const refs = await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    const model = structuredClone(host.props.index) as CatalogueReadModel;
    const home = model.screens.find((entry) => entry.path === "home")!;
    home.useCasePaths = ["tour"];
    model.useCases = [
      {
        kind: "use-case",
        path: "tour",
        detailId: home.detailId,

        title: "Tour",
        tags: [],
        details: home.details,
        changes: home.changes,
        steps: [{ screenPath: "home" }, { screenPath: "home" }],
      },
    ];
    model.tree = [...model.tree, { kind: "entry", path: "tour" }];
    const view = host.details["home"]!.views.find(
      (candidate) =>
        candidate.viewport === "desktop" && candidate.colorScheme === "light",
    )!;
    if (view.usage.status !== "ready") throw new Error("Expected ready usage");
    const key = view.usage.instances.find(
      (instance) => instance.id === "action",
    )!.key;
    host.props = {
      ...host.props,
      index: model,
      defaultSelection: { screenPath: "tour", viewport: "both" },
    } as MoklyViewerProps;
    host.render();
    return [0, 1].map((stepIndex): InstanceRef => ({
      screenPath: "home",
      stepIndex,
      viewport: "desktop",
      colorScheme: "light",
      key,
    }));
  });
  await page.waitForFunction(
    () => window.viewerHarness.get("one").ref.current !== null,
  );
  await expect(useCaseSteps(page)).toHaveCount(2);
  await page.evaluate(
    (refs) =>
      window.viewerHarness.get("one").ref.current.highlightInstances(refs),
    refs,
  );
  await expectPresentation(page, [0, 1]);
});

test("same-origin on the canvas highlights refs of both schemes and rejects a missing ref without changing the prior highlight", async ({
  page,
}) => {
  await openViewer(page);
  await page.waitForFunction(
    () => window.viewerHarness.get("one").ref.current !== null,
  );
  // The canvas shows each view in each scheme, so a ref may name a Dark
  // view beside the Light ones.
  const refs = [
    homeInstance("mobile", "light"),
    homeInstance("desktop", "light"),
    homeInstance("desktop", "dark"),
  ];
  await page.evaluate(
    (refs) =>
      window.viewerHarness.get("one").ref.current.highlightInstances(refs),
    refs,
  );
  await expectPresentation(page, [0, 1, 2]);
  const missing = { ...refs[1]!, key: "f".repeat(64) };
  const outcome = await page.evaluate(
    async ({ refs, missing }) => {
      try {
        await window.viewerHarness
          .get("one")
          .ref.current.highlightInstances([...refs, missing]);
        return "resolved";
      } catch {
        return "rejected";
      }
    },
    { refs, missing },
  );
  expect(outcome).toBe("rejected");
  await expectPresentation(page, [0, 1, 2]);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error"),
    ),
  ).toHaveLength(1);
});

test("same-origin below the layout breakpoint, rejects a mixed-scheme ref without changing the prior highlight", async ({
  page,
}) => {
  // The compact layout shows one frame, Mobile · Light under Light, so a
  // ref of its Dark view names a view that it does not show.
  await page.setViewportSize(NARROW_WINDOW);
  await openViewer(page);
  const refs = [homeInstance("mobile", "light")];
  await page.waitForFunction(
    () => window.viewerHarness.get("one").ref.current !== null,
  );
  await page.evaluate(
    (refs) =>
      window.viewerHarness.get("one").ref.current.highlightInstances(refs),
    refs,
  );
  await expectPresentation(page, [0]);
  const mismatched = homeInstance("mobile", "dark");
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
  await expectPresentation(page, [0]);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error"),
    ),
  ).toHaveLength(1);
});
