import { expect, test } from "@playwright/test";

import { prepareLiveRuntime } from "../../dist/build/live_runtime.js";
import { loadConfig } from "../../dist/config/load.js";
import { startCatalogueServer } from "../../dist/server/http.js";
import { createFixture, removeFixture } from "../helpers/fixture.js";
import { reverseProxy } from "../helpers/reverse_proxy.js";

import { interactiveShellSource } from "./interactive_shell_fixture.js";
import {
  expectLiveReady,
  expectStatic,
  liveFrame,
  previewMode,
} from "./interactive_shell_helpers.js";

for (const rewriteHost of [true, false])
  test(`forwarded catalogue edits props and mounts Live (rewrite Host: ${rewriteHost})`, async ({
    page,
  }, testInfo) => {
    const fixture = await createFixture(interactiveShellSource(true), {
      extraConfig: 'interactive: "serve",',
    });
    try {
      const app = await reverseProxy("catalogue.localhost", rewriteHost);
      fixture.beforeRemove(() => app.close());
      const live = await reverseProxy("live.localhost", rewriteHost);
      fixture.beforeRemove(() => live.close());
      const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
      const server = await startCatalogueServer(runtime.config, {
        appOrigin: app.url,
        base: "main",
        changesStatus: "unavailable",
        componentRuntime: runtime,
        interactiveOrigin: live.url,
        manifest: runtime.manifest,
        port: 0,
      });
      fixture.beforeRemove(() => server.close());
      app.forwardTo(server.url);
      live.forwardTo(`http://127.0.0.1:${server.interactivePort}`);
      const opened = await page.goto(`${app.url}/view/components/counter.html`);
      expect(opened?.status()).toBe(200);
      await page
        .getByLabel("Viewport", { exact: true })
        .selectOption("desktop");
      await page.getByRole("tab", { name: "Props", exact: true }).click();
      const rendered = page.waitForResponse((response) =>
        response.url().endsWith("/__mokly/components/render"),
      );
      await page.getByLabel("Label", { exact: true }).fill("Forwarded edit");
      expect.soft((await rendered).status()).toBe(200);
      await expect(
        page.frameLocator('[data-workspace-frame="desktop"]').locator("#count"),
      ).toHaveText("Forwarded edit: 0");
      const prepared = page.waitForResponse((response) =>
        /\/__mokly\/interactive\/[a-f0-9]{32}\/prepare$/.test(response.url()),
      );
      await previewMode(page).getByRole("button", { name: "Live" }).click();
      expect.soft((await prepared).status()).toBe(200);
      await expectLiveReady(page);
      const url = new URL(
        await liveFrame(page, "desktop")
          .locator("body")
          .evaluate(() => window.location.href),
      );
      expect(url.origin).toBe(live.url);
      expect(url.searchParams.get("mokly-host")).toBe(app.url);
      await expect(liveFrame(page, "desktop").locator("#count")).toHaveText(
        "Saved: 0",
      );
      await liveFrame(page, "desktop").locator("#increment").click();
      await expect(liveFrame(page, "desktop").locator("#count")).toHaveText(
        "Saved: 1",
      );
      await previewMode(page).getByRole("button", { name: "Static" }).click();
      await expectStatic(page);
      await expect(page.getByLabel("Label", { exact: true })).toBeVisible();
      const renderedAgain = page.waitForResponse((response) =>
        response.url().endsWith("/__mokly/components/render"),
      );
      await page
        .getByLabel("Label", { exact: true })
        .fill("Forwarded second edit");
      expect((await renderedAgain).status()).toBe(200);
      await expect(
        page.frameLocator('[data-workspace-frame="desktop"]').locator("#count"),
      ).toHaveText("Forwarded second edit: 0");
      expect(
        app.requests.filter((request) => request.path.endsWith("/render")),
      ).toEqual([
        {
          host: new URL(app.url).host,
          origin: app.url,
          path: "/__mokly/components/render",
          status: 200,
        },
        {
          host: new URL(app.url).host,
          origin: app.url,
          path: "/__mokly/components/render",
          status: 200,
        },
      ]);
      expect(
        app.requests.filter((request) => request.path.endsWith("/prepare")),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ origin: app.url, status: 200 }),
        ]),
      );
      await testInfo.attach("proxy-requests", {
        body: JSON.stringify(app.requests, null, 2),
        contentType: "application/json",
      });
    } finally {
      await page.goto("about:blank");
      await removeFixture(fixture);
    }
  });
