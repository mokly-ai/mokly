import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";

import {
  incrementalConfig,
  incrementalFixture,
} from "./fixtures/vite_incremental.js";
import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";
import { reportDuration } from "./helpers/durations.js";

for (const callback of [
  {
    hook: "watchChange",
    setup: `watchChange(file, { event }) { return changed(event, file, this.environment.name); },`,
    events: [
      "update:label.ts:client",
      "create:probe.txt:client",
      "delete:probe.txt:client",
    ],
  },
  {
    hook: "configureServer listener",
    setup: `configureServer(server) {
      server.watcher.on("change", (file) => changed("change", file));
      server.watcher.on("all", (event, file) => {
        if (event !== "change") return changed(event, file);
      });
    },`,
    events: ["change:label.ts", "add:probe.txt", "unlink:probe.txt"],
  },
]) {
  test(`Vite dispatches each watched change once to a ${callback.hook}`, async (context) => {
    const fixture = await reviewFixture(context);
    const stylesheet = "styles/site.css";
    await fixture.write(".context/events", "");
    await fixture.write(stylesheet, ".site { color: teal }");
    await fixture.write("src/label.ts", 'export const label = "before";');
    await fixture.write(
      "src/review.mockup.ts",
      reviewPage("label", 'import { label } from "./label.ts";'),
    );
    await fixture.write(
      "vite.config.ts",
      `import { appendFile } from "node:fs/promises";
       import { basename, resolve } from "node:path";
       let cached;
       async function changed(event, file, environment) {
         const name = basename(file);
         if (name !== "label.ts" && name !== "probe.txt") return;
         await appendFile(resolve(import.meta.dirname, ".context/events"),
           [event, name, ...(environment ? [environment] : [])].join(":") + "\\n");
         if (name === "label.ts") cached = undefined;
       }
       export default { plugins: [{ name: "cache-until-change",
         ${callback.setup}
         transform(code, id) { if (id.endsWith("/label.ts")) return cached ??= code; },
       }] };`,
    );
    const render = async () =>
      (await fixture.render(await fixture.compile())).html;
    assert.match(await render(), /<body>before<\/body>/);
    await fixture.write("src/label.ts", 'export const label = "after";');
    await fixture.sidecar.call<ViteCssResult>("transformViteCss", {
      setup: fixture.params,
      stylesheet,
      file: path.join(fixture.root, stylesheet),
    });
    assert.match(await render(), /<body>after<\/body>/);
    await fixture.write("src/probe.txt", "created");
    assert.match(await render(), /<body>after<\/body>/);
    await fs.unlink(path.join(fixture.root, "src/probe.txt"));
    assert.match(await render(), /<body>after<\/body>/);
    assert.match(await render(), /<body>after<\/body>/);
    assert.equal(
      await fs.readFile(path.join(fixture.root, ".context/events"), "utf8"),
      callback.events.join("\n") + "\n",
    );
    await fixture.sidecar.call("shutdown");
  });
}

test("a Vite Serve edit transforms only the changed file and all of its query variants", async (context) => {
  await reportDuration(
    "Vite incremental module edit",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await incrementalFixture(context);
      const first = await fixture.compile();
      assert.match(
        (await fixture.render(first)).html,
        /before\|export const message = "before";/,
      );
      assert.deepEqual(await fixture.transforms(), [
        "src/live-message.ts",
        "src/live-message.ts?raw",
        "src/live-stable.ts",
        "src/live.mockup.ts",
      ]);
      await fixture.clear();
      const source = 'export const message = "after";';
      await fixture.write("src/live-message.ts", source);
      const second = await fixture.compile();
      assert.match(
        (await fixture.render(second)).html,
        /after\|export const message = "after";/,
      );
      assert.equal(
        second.modules.find((module) => module.path === "src/live-message.ts")
          ?.digest,
        createHash("sha256").update(source).digest("hex"),
      );
      assert.deepEqual(await fixture.transforms(), [
        "src/live-message.ts",
        "src/live-message.ts?raw",
      ]);
      assert.deepEqual(await fixture.setups(), []);
      assert.match(
        (await fixture.render(first)).html,
        /before\|export const message = "before";/,
      );
      await fixture.sidecar.call("shutdown");
    },
  );
});

test("Vite Serve reloads config files, their imports, and env files", async (context) => {
  await reportDuration(
    "Vite setup reload",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await incrementalFixture(context);
      assert.match(
        (await fixture.render(await fixture.compile())).html,
        /\|setup\|env-before/,
      );
      await fixture.clear();
      await fixture.write("vite.config.ts", incrementalConfig("-config"));
      assert.match(
        (await fixture.render(await fixture.compile())).html,
        /\|setup-config\|env-before/,
      );
      await fixture.write("vite-label.ts", 'export const label = "imported";');
      assert.match(
        (await fixture.render(await fixture.compile())).html,
        /\|imported-config\|env-before/,
      );
      await fixture.write(".env.development", "VITE_LIVE=env-after\n");
      assert.match(
        (await fixture.render(await fixture.compile())).html,
        /\|imported-config\|env-after/,
      );
      assert.deepEqual(await fixture.setups(), [
        "setup",
        "imported",
        "imported",
      ]);
      await fixture.sidecar.call("shutdown");
    },
  );
});

test("Vite Serve invalidates the full graph when a new file changes resolution or metadata changes", async (context) => {
  await reportDuration(
    "Vite resolution invalidation",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await incrementalFixture(context);
      assert.match(
        (await fixture.render(await fixture.compile())).html,
        /before\|/,
      );
      const initial = await fixture.transforms();
      await fixture.clear();
      await fixture.write(
        "src/live-message.js",
        'export const message = "preferred";',
      );
      assert.match(
        (await fixture.render(await fixture.compile())).html,
        /preferred\|/,
      );
      assert.deepEqual(await fixture.transforms(), [
        "src/live-message.js",
        "src/live-message.ts?raw",
        "src/live-stable.ts",
        "src/live.mockup.ts",
      ]);
      await fixture.clear();
      await fixture.write("package.json", '{"type":"module","name":"updated"}');
      assert.match(
        (await fixture.render(await fixture.compile())).html,
        /preferred\|/,
      );
      assert.equal((await fixture.transforms()).length, initial.length);
      await fixture.sidecar.call("shutdown");
    },
  );
});

test("Vite checks rebuild files again at the next bundle after they leave the graph", async (context) => {
  const fixture = await reviewFixture(context);
  fixture.params.viteInputs = { rebuildFiles: ["copy.json"] };
  await fixture.write("copy.json", '{"copy":"before"}');
  await fixture.write(
    "vite.config.mjs",
    `import { readFileSync } from 'node:fs';
const { copy } = JSON.parse(readFileSync(new URL('./copy.json', import.meta.url), 'utf8'));
export default { define: { __COPY__: JSON.stringify(copy) } };`,
  );
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage(
      "data.copy + '|' + __COPY__",
      'import data from "../copy.json";',
    ),
  );
  const first = await fixture.compile();
  assert.match(
    (await fixture.render(first)).html,
    /<body>before\|before<\/body>/,
  );

  await fixture.write("src/review.mockup.ts", reviewPage("__COPY__"));
  await fixture.write("copy.json", '{"copy":"after"}');
  const next = await fixture.compile();
  assert.match((await fixture.render(next)).html, /<body>after<\/body>/);
  await fixture.sidecar.call("shutdown");
});
