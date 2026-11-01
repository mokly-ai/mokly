import { expect } from "@playwright/test";

import type {
  FrameAdapter,
  FrameEvent,
  MountedFrame,
  MoklyViewerProps,
} from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";
import { unavailableResourceNotice } from "./document_error_allowance.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});
test.beforeEach(async ({ page }) => {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
});

test("concurrent pick is idempotent and cancellation rejects pending activation", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    await Promise.all([
      host.ref.current.startPick(),
      host.ref.current.startPick(),
    ]);
    host.ref.current.cancelPick();
    host.ref.current.cancelPick();
  });
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name.startsWith("pick")),
    ),
  ).toEqual([
    { name: "pick-start", value: null },
    { name: "pick-end", value: { reason: "cancelled" } },
  ]);
  const cancelled = await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    let attempted!: () => void;
    const attempt = new Promise<void>((resolve) => {
      attempted = resolve;
    });
    host.props.frameAdapter = {
      mount: () => {
        attempted();
        return new Promise<MountedFrame>(() => {});
      },
    };
    host.render();
    await attempt;
    const pending = host.ref.current.startPick().then(
      () => false,
      () => true,
    );
    host.ref.current.cancelPick();
    return pending;
  });
  expect(cancelled).toBe(true);
});

test("a failed URL index source can retry", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError(
    unavailableResourceNotice(`${fixture.host.url}/public-catalogue.json`),
  );
  await page.evaluate(() => window.viewerHarness.start("one"));
  let attempts = 0;
  await page.route("**/public-catalogue.json", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.fulfill({ json: fixture.index });
  });
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    host.props = {
      ...host.props,
      index: new URL("/public-catalogue.json", location.href),
      theme: "dark",
    } as MoklyViewerProps;
    delete host.props.baseUrl;
    host.render();
  });
  await expect(page.getByRole("alert")).toContainText(
    "The catalogue could not be loaded",
  );
  await expect(page.locator("#one .mokly-viewer")).toHaveAttribute(
    "data-mokly-theme",
    "dark",
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#one .mokly-viewer")).toHaveAttribute(
    "data-mokly-theme",
    "dark",
  );
  expect(attempts).toBe(2);
  expect(
    await page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error")
        .map((event) => event.value),
    ),
  ).toEqual([
    {
      code: "catalogue",
      message: "The catalogue could not be loaded. Try again.",
    },
  ]);
});

test("another deployment keeps the stage loading until the host replaces the index", async ({
  page,
}) => {
  const other = "1".repeat(64);
  let deploymentId = fixture.index.deploymentId;
  await page.route("**/mokly-viewer/deployment.json", (route) =>
    route.fulfill({ json: { schemaVersion: 1, deploymentId } }),
  );
  await page.evaluate((deploymentId) => {
    const seen = { unavailable: false };
    (window as unknown as { stageSeen: typeof seen }).stageSeen = seen;
    new MutationObserver(() => {
      if (document.body.textContent?.includes("could not be shown"))
        seen.unavailable = true;
    }).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    const host = window.viewerHarness.start("one");
    host.details["home"] = { ...host.details["home"]!, detailId: deploymentId };
  }, other);
  const errors = () =>
    page.evaluate(() =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error")
        .map((event) => event.value),
    );
  const changed = {
    code: "catalogue",
    message: "The catalogue changed. Reload it to see the new version.",
  };
  await expect.poll(errors).toEqual([changed]);
  const viewer = page.locator("#one");
  await expect(
    viewer.getByRole("status").filter({ hasText: "Loading preview…" }),
  ).toBeVisible();
  deploymentId = other;
  await page.evaluate((deploymentId) => {
    const host = window.viewerHarness.get("one");
    host.props = {
      ...host.props,
      index: { ...(host.props.index as object), deploymentId },
    } as MoklyViewerProps;
    host.render();
  }, other);
  await expect(viewer.locator("iframe").first()).toBeVisible();
  await expect(viewer.getByText("Loading preview…")).toHaveCount(0);
  // The unavailable stage with Try again never appeared, and one deployment
  // change reported one error.
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { stageSeen: { unavailable: boolean } }).stageSeen
          .unavailable,
    ),
  ).toBe(false);
  expect(await errors()).toEqual([changed]);
});

test("frame failures end picking once and reject one handle with one safe error", async ({
  page,
}) => {
  await page.evaluate(() => window.viewerHarness.start("one"));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
  const result = await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    let emit: ((event: FrameEvent) => void) | undefined;
    let installed!: () => void;
    const installation = new Promise<void>((resolve) => {
      installed = resolve;
    });
    const adapter: FrameAdapter = {
      async mount() {
        return {
          listInstanceBoundaries: async () => [],
          highlight: async () => {},
          scrollTo: async () => {},
          subscribe(fn) {
            emit = fn;
            installed();
            return () => {};
          },
          dispose() {},
        };
      },
    };
    host.props.frameAdapter = adapter;
    host.render();
    await installation;
    await host.ref.current.startPick();
    emit?.({ type: "error", code: "timeout" });
    emit?.({ type: "pick-end", reason: "escape" });
    return host.events
      .filter((event) => event.name === "pick-end")
      .map((event) => event.value);
  });
  expect(result).toEqual([{ reason: "error" }]);
  const failures = await page.evaluate(async () => {
    const host = window.viewerHarness.get("one");
    host.events.length = 0;
    let attempted!: () => void;
    const attempt = new Promise<void>((resolve) => {
      attempted = resolve;
    });
    host.props.frameAdapter = {
      mount: async () => {
        attempted();
        throw new Error("/private/user/source.ts");
      },
    };
    host.render();
    await attempt;
    try {
      await host.ref.current.startPick();
    } catch {
      /* The assertion below checks the one reported failure. */
    }
    return host.events
      .filter((event) => event.name === "error")
      .map((event) => event.value);
  });
  expect(failures).toEqual([
    {
      code: "frame",
      message: "This instance is unavailable in the current view.",
    },
  ]);
});
