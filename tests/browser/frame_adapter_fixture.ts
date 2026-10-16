import type { Page } from "@playwright/test";

import type {
  FrameEvent,
  MountedFrame,
} from "../../packages/viewer/src/client/frame_adapter.js";
import type * as PostAdapter from "../../packages/viewer/src/client/post_message_adapter.js";
import type { BrowserUsage } from "../../packages/viewer/tests/browser_documents.js";
import { crossOriginFixture } from "../../packages/viewer/tests/standalone_fixture.js";
export { crossOriginFixture };
export interface FrameTestWindow extends Window {
  mounted: MountedFrame;
  frameEvents: FrameEvent[];
  wire: Record<string, unknown>[];
  unsubscribe: () => void;
}
export async function mountCrossFrame(
  page: Page,
  fixture: Awaited<ReturnType<typeof crossOriginFixture>>,
  path = "/static/mokly-generated/home/index.mobile.html",
) {
  await page.goto(fixture.host.url);
  await page.evaluate(
    async ({ origin, usageJson, path }) => {
      const usage = JSON.parse(usageJson) as BrowserUsage;
      const state = window as unknown as FrameTestWindow;
      const { postMessageAdapter } = (await import(
        `${location.origin}/mokly-viewer/client/post_message_adapter.js`
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
          usage: usage,
        },
      );
      state.unsubscribe = state.mounted.subscribe((event) =>
        state.frameEvents.push(event),
      );
      await state.mounted.listInstanceBoundaries();
    },
    {
      origin: fixture.frames.url,
      usageJson: JSON.stringify(fixture.usage),
      path,
    },
  );
}
