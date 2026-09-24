import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import { controlsEntrySource } from "./helpers/component_controls_fixture.js";
import { settledRenderCapability } from "./helpers/component_controls_state.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test(
  "watched controls adopt only successful graphs and never publish edits or delay Browse",
  { timeout: 25_000 },
  async (t) => {
    const source = controlsEntrySource();
    const fixture = await createFixture(source, {
      extraConfig: 'watch: { rules: [{ action: "reload", paths: ["**/*"] }] },',
    });
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const server = await serve(config, { port: 0, watch: true });
    fixture.beforeRemove(() => server.close());
    const capabilities = async () => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const html = await (
          await fetch(`${server.url}/view/components/action.html`)
        ).text();
        const capability = settledRenderCapability(html);
        if (capability) return capability;
        await delay(25);
      }
      throw new Error(
        "component controls did not settle after background work",
      );
    };
    const first = await capabilities();
    const render = async (capability: typeof first, label: string) =>
      fetch(`${server.url}/__mokly/components/render`, {
        method: "POST",
        headers: {
          origin: server.url,
          "content-type": "application/json",
          "x-mokly-render-token": capability.token,
        },
        body: JSON.stringify({
          componentId: "action",
          variantId: "default",
          viewport: "desktop",
          colorScheme: "light",
          generation: capability.generation,
          pageId: "a".repeat(32),
          overrides: { label: { kind: "set", value: ["string", label] } },
        }),
      });
    const generated = await fs.readFile(
      `${config.generatedDir}/mokly-manifest.json`,
      "utf8",
    );
    assert.equal((await render(first, "Edited")).status, 200);
    await delay(150);
    assert.deepEqual(await capabilities(), first);
    assert.equal(
      await fs.readFile(`${config.generatedDir}/mokly-manifest.json`, "utf8"),
      generated,
    );
    await fs.writeFile(fixture.entryPath, "syntax error candidate");
    await delay(250);
    assert.deepEqual(await capabilities(), first);
    assert.equal((await render(first, "Last good")).status, 200);
    const hanging = render(first, "Hang");
    await delay(100);
    const started = Date.now();
    assert.equal((await fetch(server.url)).status, 200);
    assert.ok(
      Date.now() - started < 1000,
      "synchronous consumer rendering must not occupy the HTTP thread",
    );
    assert.equal((await hanging).status, 422);
    assert.equal((await render(first, "Recovered")).status, 200);
    await fs.writeFile(
      fixture.entryPath,
      source.replace(
        "{props.label}</button>",
        "{props.label} updated</button>",
      ),
    );
    let latest = first;
    const deadline = Date.now() + 5000;
    while (latest.generation === first.generation && Date.now() < deadline) {
      await delay(50);
      latest = await capabilities();
    }
    assert.notEqual(latest.generation, first.generation);
    assert.equal((await render(first, "Obsolete")).status, 409);
    const response = await render(latest, "Fresh");
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.match(
      await (await fetch(server.url + result.previewUrl)).text(),
      /Fresh.*updated/,
    );
  },
);
