import { expect, test, type Page } from "@playwright/test";

import type { MountedFrame } from "../../packages/viewer/dist/client/frame_adapter.js";
import type * as LocalAdapter from "../../packages/viewer/dist/client/same_origin_adapter.js";

import {
  crossOriginFixture,
  type FrameTestWindow,
} from "./frame_adapter_fixture.js";

interface IdentityTestWindow extends FrameTestWindow {
  replacement: Promise<MountedFrame>;
}

let fixture: Awaited<ReturnType<typeof crossOriginFixture>>;

test.beforeAll(async () => {
  fixture = await crossOriginFixture();
});

test.afterAll(async () => {
  await fixture?.close();
});

test("an unowned same-origin document gains no navigation privilege during handoff", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.evaluate(async () => {
    const { sameOriginAdapter } = (await import(
      `${location.origin}/__mokly/client/same_origin_adapter.js`
    )) as typeof LocalAdapter;
    const state = window as unknown as IdentityTestWindow;
    state.frameEvents = [];
    state.mounted = await sameOriginAdapter().mount(
      document.querySelector<HTMLIFrameElement>("#frame")!,
      {
        url: new URL(
          "/static/.generated/screens/home.mobile.html",
          location.origin,
        ),
        route: "screens/home.mobile.html",
        generatedPathPrefix: ".generated",
        usage: { status: "unavailable" },
      },
    );
  });

  const frame = page.frameLocator("#frame");
  await frame.locator("#unowned-link").click();
  await expect(frame.locator("#unowned-marker")).toBeVisible();

  let releaseRequest = () => {};
  let reportRequest = () => {};
  const requestStarted = new Promise<void>((resolve) => {
    reportRequest = resolve;
  });
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route(
    "**/static/.generated/screens/home.mobile.html",
    async (route) => {
      reportRequest();
      await requestReleased;
      await route.continue();
    },
  );

  try {
    await page.evaluate(async () => {
      const { sameOriginAdapter } = (await import(
        `${location.origin}/__mokly/client/same_origin_adapter.js`
      )) as typeof LocalAdapter;
      const state = window as unknown as IdentityTestWindow;
      const onEvent = state.frameEvents.push.bind(state.frameEvents);
      state.replacement = sameOriginAdapter().mount(
        document.querySelector<HTMLIFrameElement>("#frame")!,
        {
          url: new URL(
            "/static/.generated/screens/home.mobile.html",
            location.origin,
          ),
          route: "screens/home.mobile.html",
          generatedPathPrefix: ".generated",
          usage: { status: "unavailable" },
          onEvent,
        },
      );
    });
    await requestStarted;

    const probe = await probeCurrentDocument(page, "#unowned-marker");
    expect(probe).toEqual({
      defaultPrevented: true,
      dispatched: false,
      fired: true,
      prevented: false,
    });
    expect(
      await page.evaluate(
        () =>
          (window as unknown as IdentityTestWindow).frameEvents.filter(
            (event) => event.type === "navigation",
          ).length,
      ),
    ).toBe(0);

    releaseRequest();
    await page.evaluate(async () => {
      const state = window as unknown as IdentityTestWindow;
      state.mounted = await state.replacement;
    });
    await frame.getByRole("link", { name: "Open Action" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as IdentityTestWindow).frameEvents.some(
            (event) => event.type === "navigation",
          ),
        ),
      )
      .toBe(true);
  } finally {
    releaseRequest();
  }
});

test("an unowned exact-resource document gains no navigation privilege during handoff", async ({
  page,
}) => {
  await page.goto(fixture.host.url);
  await page.evaluate(async () => {
    const { sameOriginAdapter } = (await import(
      `${location.origin}/__mokly/client/same_origin_adapter.js`
    )) as typeof LocalAdapter;
    const state = window as unknown as IdentityTestWindow;
    state.frameEvents = [];
    state.mounted = await sameOriginAdapter().mount(
      document.querySelector<HTMLIFrameElement>("#frame")!,
      {
        url: new URL(
          "/static/.generated/screens/home.mobile.html",
          location.origin,
        ),
        route: "screens/home.mobile.html",
        generatedPathPrefix: ".generated",
        usage: { status: "unavailable" },
      },
    );
  });

  let matchingRequests = 0;
  let releaseRequest = () => {};
  let reportRequest = () => {};
  const requestStarted = new Promise<void>((resolve) => {
    reportRequest = resolve;
  });
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route(
    "**/static/.generated/screens/home.mobile.html?handoff=exact",
    async (route) => {
      matchingRequests++;
      if (matchingRequests === 1) {
        await route.continue();
        return;
      }
      reportRequest();
      await requestReleased;
      await route.continue();
    },
  );

  const frame = page.frameLocator("#frame");
  await frame.locator("#exact-resource-link").click();
  await expect
    .poll(() =>
      page
        .locator("#frame")
        .evaluate((element: HTMLIFrameElement) =>
          element.contentDocument?.URL.endsWith(
            "/static/.generated/screens/home.mobile.html?handoff=exact",
          ),
        ),
    )
    .toBe(true);

  try {
    await page.evaluate(async () => {
      const { sameOriginAdapter } = (await import(
        `${location.origin}/__mokly/client/same_origin_adapter.js`
      )) as typeof LocalAdapter;
      const state = window as unknown as IdentityTestWindow;
      const onEvent = state.frameEvents.push.bind(state.frameEvents);
      state.replacement = sameOriginAdapter().mount(
        document.querySelector<HTMLIFrameElement>("#frame")!,
        {
          url: new URL(
            "/static/.generated/screens/home.mobile.html?handoff=exact",
            location.origin,
          ),
          route: "screens/home.mobile.html",
          generatedPathPrefix: ".generated",
          usage: { status: "unavailable" },
          onEvent,
        },
      );
    });
    await requestStarted;

    const probe = await probeCurrentDocument(
      page,
      '[data-mokly-link="action"]',
    );
    expect(probe).toEqual({
      defaultPrevented: true,
      dispatched: false,
      fired: true,
      prevented: false,
    });
    expect(
      await page.evaluate(
        () =>
          (window as unknown as IdentityTestWindow).frameEvents.filter(
            (event) => event.type === "navigation",
          ).length,
      ),
    ).toBe(0);

    releaseRequest();
    await page.evaluate(async () => {
      const state = window as unknown as IdentityTestWindow;
      state.mounted = await state.replacement;
    });
    await frame.getByRole("link", { name: "Open Action" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as IdentityTestWindow).frameEvents.some(
            (event) => event.type === "navigation",
          ),
        ),
      )
      .toBe(true);
  } finally {
    releaseRequest();
  }
});

async function probeCurrentDocument(page: Page, selector: string) {
  return page.evaluate((target) => {
    const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
    const doc = frame.contentDocument!;
    const element = doc.querySelector(target)!;
    let prevented: boolean | undefined;
    let fired = false;
    doc.addEventListener(
      "click",
      (event) => {
        fired = true;
        prevented = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const dispatched = element.dispatchEvent(event);
    return {
      defaultPrevented: event.defaultPrevented,
      dispatched,
      fired,
      prevented,
    };
  }, selector);
}
