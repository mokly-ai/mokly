/**
 * Exceptions that host code throws inside an embedded viewer, under the viewer
 * selection and marker contracts: a host callback, host slot content, and the
 * cleanup of a host frame adapter are not viewer failures. Each exception
 * reaches the host unchanged, without `onError` and without the failure state.
 */

import { expect, type Page } from "@playwright/test";

import { viewerFixture } from "../../packages/viewer/tests/browser_fixture.js";

import { test } from "./browser_test.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof viewerFixture>>;
test.beforeAll(async () => {
  fixture = await viewerFixture();
});
test.afterAll(async () => {
  await fixture?.close();
});

interface HostProbe {
  mounted: number;
  same: boolean;
}

async function startViewer(page: Page) {
  await page.goto(fixture.host.url);
  await page.waitForFunction(() => Boolean(window.viewerHarness));
  await page.evaluate(() => window.viewerHarness.start("one"));
  await page.waitForFunction(() =>
    Boolean(window.viewerHarness.get("one").ref.current),
  );
}

/** The host's root unmounted with the host's own value, and no viewer error. */
async function expectHostReceived(page: Page) {
  // No host error boundary exists, so the host's React root unmounts.
  await expect(page.locator("#one .mokly-viewer")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      same: (window as unknown as { hostProbe: HostProbe }).hostProbe.same,
      errors: window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "error"),
    })),
  ).toEqual({ same: true, errors: [] });
}

for (const [source, journey] of [
  ["callback", "a host callback that throws inside a viewer effect"],
  ["primitive", "a host callback that throws a primitive inside an effect"],
  ["slot", "host slot content that throws while it renders"],
] as const)
  test(`${journey} reaches the host unchanged`, async ({
    page,
    allowBrowserError,
  }) => {
    const message = `Host ${source} failure`;
    allowBrowserError({
      kind: "pageerror",
      message: new RegExp(`^${message}$`, "u"),
    });
    await startViewer(page);
    await page.evaluate(
      ({ source, message }) => {
        const host = window.viewerHarness.get("one");
        const error = source === "primitive" ? message : new Error(message);
        const probe: HostProbe = { mounted: 0, same: false };
        (window as unknown as { hostProbe: HostProbe }).hostProbe = probe;
        window.addEventListener("error", (event) => {
          if (event.error === error) probe.same = true;
        });
        if (source === "slot") {
          host.props.slots = {
            topBarStart: window.viewerHarness.thrower(error),
          };
          host.render();
          return;
        }
        // The marker's screen is not shown, so the marker layer's effect
        // reports its state at once.
        host.props.onMarkerChange = () => {
          throw error;
        };
        host.setMarkers([
          {
            id: "marker",
            instance: {
              screenPath: "missing",
              viewport: "mobile",
              colorScheme: "light",
              key: "missing",
            },
          },
        ]);
      },
      { source, message },
    );
    await expectHostReceived(page);
  });

test("a host frame adapter whose cleanup throws on navigation reaches the host unchanged", async ({
  page,
  allowBrowserError,
}) => {
  allowBrowserError({ kind: "pageerror", message: /^Host cleanup failure$/u });
  await startViewer(page);
  await page.evaluate(() => {
    const host = window.viewerHarness.get("one");
    const error = new Error("Host cleanup failure");
    const probe: HostProbe = { mounted: 0, same: false };
    (window as unknown as { hostProbe: HostProbe }).hostProbe = probe;
    window.addEventListener("error", (event) => {
      if (event.error === error) probe.same = true;
    });
    const original = host.props.frameAdapter!;
    host.props.frameAdapter = {
      async mount(frame, options) {
        const mounted = await original.mount(frame, options);
        probe.mounted++;
        return {
          ...mounted,
          dispose() {
            mounted.dispose();
            throw error;
          },
        };
      },
    };
    host.render();
  });
  await page.waitForFunction(
    () => (window as unknown as { hostProbe: HostProbe }).hostProbe.mounted > 0,
  );
  // The catalogue home has no frame, so the screen's frame unmounts.
  await page.evaluate(() =>
    window.viewerHarness.get("one").ref.current.select({ screenPath: null }),
  );
  await expectHostReceived(page);
});
