import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type { ViewerCapabilityDescriptor } from "../packages/viewer/dist/client/host_capability_descriptor.js";

import { startWatchedServe } from "./browser/watched_serve.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { httpRequest } from "./helpers/http_request.js";

test(
  "watched CLI preserves both origin options through real child restarts",
  { timeout: 60_000 },
  async (t) => {
    const appOrigin = "https://catalogue.example:8443";
    const interactiveOrigin = "https://live.example:9443";
    const appHost = new URL(appOrigin).host;
    const running = await startWatchedServe(componentEntrySource(), {
      extraConfig: 'interactive: "serve", watch: { debounceMs: 0 },',
      argv: [
        "--app-origin",
        appOrigin,
        "--interactive-origin",
        interactiveOrigin,
      ],
    });
    t.after(() => running.stop());
    const url = running.url + "/view/action/";
    let previousGeneration: string | undefined;
    let previousPort: number | undefined;
    for (let restart = 0; restart < 3; restart += 1) {
      const descriptor = await nextGeneration(url, appHost, previousGeneration);
      assert.ok(descriptor.interactive);
      assert.ok(descriptor.renderCapability);
      const { generation, origin, port } = descriptor.interactive;
      assert.equal(origin, interactiveOrigin);
      if (previousPort !== undefined) assert.equal(port, previousPort);
      const prepared = await httpRequest(
        `${running.url}/__mokly/interactive/${generation}/prepare`,
        "POST",
        { host: appHost, origin: appOrigin },
      );
      assert.equal(prepared.status, 200, prepared.body);
      const body = JSON.stringify({
        componentId: "action",
        variantPath: "action/default",
        viewport: "desktop",
        colorScheme: "light",
        generation: descriptor.renderCapability.generation,
        pageId: "f".repeat(32),
        overrides: {
          label: { kind: "set", value: ["string", `Edit ${restart}`] },
        },
      });
      const rendered = await httpRequest(
        `${running.url}/__mokly/components/render`,
        "POST",
        {
          host: appHost,
          origin: appOrigin,
          "content-type": "application/json",
          "x-mokly-render-token": descriptor.renderCapability.token,
        },
        body,
      );
      assert.equal(rendered.status, 200, rendered.body);
      const document = await httpRequest(
        `http://127.0.0.1:${port}/static/action/default/index.desktop.html?mokly-host=${encodeURIComponent(appOrigin)}`,
        "GET",
        { host: new URL(interactiveOrigin).host },
      );
      assert.equal(document.status, 200, document.body);
      assert.equal(
        document.headers["content-security-policy"],
        `frame-ancestors http://localhost:${new URL(running.url).port} ${running.url} ${appOrigin}`,
      );
      assert.equal(
        (
          await httpRequest(url, "GET", {
            host: "attacker.example",
            "x-forwarded-host": appHost,
          })
        ).status,
        403,
      );
      previousGeneration = generation;
      previousPort = port;
      if (restart < 2) await fs.appendFile(running.fixture.configPath, "\n");
    }
  },
);

async function nextGeneration(
  url: string,
  host: string,
  previous?: string,
): Promise<ViewerCapabilityDescriptor> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await httpRequest(url, "GET", { host });
      const json = response.body.match(
        /<script[^>]*data-mokly-host-capability-state=""[^>]*>([^<]+)<\/script>/,
      )?.[1];
      if (response.status === 200 && json) {
        const descriptor = JSON.parse(json) as ViewerCapabilityDescriptor;
        if (descriptor.interactive?.generation !== previous) return descriptor;
      }
    } catch {
      // The old child closes its socket before its replacement binds.
    }
    await delay(25);
  }
  throw new Error(
    "The watched CLI did not expose the next forwarded generation",
  );
}
