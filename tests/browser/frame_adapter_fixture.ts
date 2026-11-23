import type { Page } from "@playwright/test";

import type { CatalogueUsage } from "@mokly/model";

import type * as PostAdapter from "../../packages/frame/src/adapters/post_message_adapter.js";
import type {
  FrameEvent,
  MountedFrame,
} from "../../packages/frame/src/frame_adapter.js";
import { crossOriginFixture } from "../../packages/viewer/tests/standalone_fixture.js";
export { crossOriginFixture };
export interface FrameTestWindow extends Window {
  mounted: MountedFrame;
  frameEvents: FrameEvent[];
  wire: Record<string, unknown>[];
  unsubscribe: () => void;
}
export async function waitForFrameEvent<T>(
  page: Page,
  type: FrameEvent["type"],
  action: () => Promise<T>,
): Promise<T> {
  const pending = await page.evaluateHandle((type) => {
    let unsubscribe = () => {};
    const event = new Promise<FrameEvent>((resolve) => {
      unsubscribe = (window as unknown as FrameTestWindow).mounted.subscribe(
        (event) => {
          if (event.type !== type) return;
          unsubscribe();
          resolve(event);
        },
      );
    });
    return { event, unsubscribe: () => unsubscribe() };
  }, type);
  try {
    const result = await action();
    const event = await page.waitForFunction(({ event }) => event, pending, {
      timeout: 10_000,
    });
    await event.dispose();
    return result;
  } finally {
    try {
      await pending.evaluate(({ unsubscribe }) => unsubscribe());
    } finally {
      await pending.dispose();
    }
  }
}
export async function mountCrossFrame(
  page: Page,
  fixture: Awaited<ReturnType<typeof crossOriginFixture>>,
  path = "/static/mokly-generated/home/index.mobile.html",
  usage: CatalogueUsage = fixture.usage,
  canvasInput = false,
) {
  await page.goto(fixture.host.url);
  await page.evaluate(
    async ({ origin, usageJson, path, canvasInput }) => {
      const usage = JSON.parse(usageJson) as CatalogueUsage;
      const state = window as unknown as FrameTestWindow;
      const { postMessageAdapter } = (await import(
        `${location.origin}/test-adapters.js`
      )) as typeof PostAdapter;
      state.wire = [];
      state.frameEvents = [];
      window.addEventListener("message", (event) => {
        try {
          state.wire.push(JSON.parse(event.data));
        } catch {
          /* Test probe ignores non-JSON messages. */
        }
      });
      state.mounted = await postMessageAdapter({ frameOrigin: origin }).mount(
        document.querySelector<HTMLIFrameElement>("#frame")!,
        {
          url: new URL(path, origin),
          usage,
          canvasInput,
        },
      );
      state.unsubscribe = state.mounted.subscribe((event) =>
        state.frameEvents.push(event),
      );
      if (usage.status === "ready")
        await state.mounted.listInstanceBoundaries();
    },
    {
      origin: fixture.frames.url,
      usageJson: JSON.stringify(usage),
      path,
      canvasInput,
    },
  );
}
