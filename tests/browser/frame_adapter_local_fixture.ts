import type { Page } from "@playwright/test";

import type * as LocalAdapter from "../../packages/frame/src/adapters/same_origin_adapter.js";
import type { BrowserUsage } from "../../packages/viewer/tests/browser_documents.js";

import type {
  crossOriginFixture,
  FrameTestWindow,
} from "./frame_adapter_fixture.js";

export async function mountLocalFrame(
  page: Page,
  fixture: Awaited<ReturnType<typeof crossOriginFixture>>,
) {
  await page.goto(fixture.host.url);
  // Direct adapter calls arrange inspection without adding host UI.
  await page.evaluate(async (usageJson) => {
    const { sameOriginAdapter } = (await import(
      `${location.origin}/test-adapters.js`
    )) as typeof LocalAdapter;
    const state = window as unknown as FrameTestWindow;
    const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
    frame.dataset["moklyGeneratedPrefix"] = "mokly-generated";
    state.frameEvents = [];
    state.mounted = await sameOriginAdapter().mount(frame, {
      url: new URL(
        "/static/mokly-generated/home/index.mobile.html",
        location.origin,
      ),
      usage: JSON.parse(usageJson) as BrowserUsage,
    });
    state.unsubscribe = state.mounted.subscribe((event) =>
      state.frameEvents.push(event),
    );
    await state.mounted.listInstanceBoundaries();
  }, JSON.stringify(fixture.usage));
}
