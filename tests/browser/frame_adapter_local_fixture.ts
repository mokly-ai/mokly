import type { Page } from "@playwright/test";

import type { CatalogueUsage } from "@mokly/model";

import type * as LocalAdapter from "../../packages/frame/src/adapters/same_origin_adapter.js";

import type {
  crossOriginFixture,
  FrameTestWindow,
} from "./frame_adapter_fixture.js";

export async function mountLocalFrame(
  page: Page,
  fixture: Awaited<ReturnType<typeof crossOriginFixture>>,
  path = "/static/mokly-generated/home/index.mobile.html",
  usage: CatalogueUsage = fixture.usage,
) {
  await page.goto(fixture.host.url);
  // Direct adapter calls arrange inspection without adding host UI.
  await page.evaluate(
    async ({ path, usageJson }) => {
      const { sameOriginAdapter } = (await import(
        `${location.origin}/test-adapters.js`
      )) as typeof LocalAdapter;
      const state = window as unknown as FrameTestWindow;
      const frame = document.querySelector<HTMLIFrameElement>("#frame")!;
      frame.dataset["moklyGeneratedPrefix"] = "mokly-generated";
      state.frameEvents = [];
      const usage = JSON.parse(usageJson) as CatalogueUsage;
      state.mounted = await sameOriginAdapter().mount(frame, {
        url: new URL(path, location.origin),
        usage,
      });
      state.unsubscribe = state.mounted.subscribe((event) =>
        state.frameEvents.push(event),
      );
      if (usage.status === "ready")
        await state.mounted.listInstanceBoundaries();
    },
    { path, usageJson: JSON.stringify(usage) },
  );
}
