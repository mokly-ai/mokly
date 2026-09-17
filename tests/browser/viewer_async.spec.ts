import { expect, test } from "@playwright/test";

import type {
  CatalogueReadModel,
  FrameAdapter,
  FrameEvent,
  MountedFrame,
  MoklyViewerProps,
} from "@mokly/viewer";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture.close();
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
    host.props.frameAdapter = {
      mount: () => new Promise<MountedFrame>(() => {}),
    };
    host.render();
    await new Promise(requestAnimationFrame);
    const pending = host.ref.current.startPick().then(
      () => false,
      () => true,
    );
    host.ref.current.cancelPick();
    return pending;
  });
  expect(cancelled).toBe(true);
});

test("fetcher replacement aborts stale work and a failed URL source can retry", async ({
  page,
}) => {
  const state = await page.evaluate(async () => {
    const host = window.viewerHarness.start("one");
    const catalogue = host.props.catalogue as CatalogueReadModel;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let stopped!: () => void;
    const aborted = new Promise<void>((resolve) => {
      stopped = resolve;
    });
    host.props = {
      ...host.props,
      catalogue: ({ signal }) =>
        new Promise((resolve) => {
          entered();
          signal.addEventListener("abort", () => {
            stopped();
            resolve({ catalogue, url: new URL(location.href) });
          });
        }),
    } as MoklyViewerProps;
    delete host.props.baseUrl;
    host.render();
    await started;
    host.props = { ...host.props, catalogue, baseUrl: location.origin };
    host.render();
    await aborted;
    return true;
  });
  expect(state).toBe(true);
  let attempts = 0;
  await page.route("**/public-catalogue.json", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.fulfill({ json: fixture.catalogue });
  });
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    host.props = {
      ...host.props,
      catalogue: new URL("/public-catalogue.json", location.href),
    } as MoklyViewerProps;
    delete host.props.baseUrl;
    host.render();
  });
  await expect(page.getByRole("alert")).toContainText(
    "The catalogue could not be loaded",
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
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

test("StrictMode starts one source transport and aborts it on unmount", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    let calls = 0,
      aborted = 0;
    window.viewerHarness.start("one", {
      strict: true,
      source: ({ signal }: { signal: AbortSignal }) => {
        calls++;
        signal.addEventListener("abort", () => {
          aborted++;
        });
        return new Promise(() => {});
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    window.viewerHarness.remove("one");
    return { calls, aborted };
  });
  expect(result).toEqual({ calls: 1, aborted: 1 });
});
