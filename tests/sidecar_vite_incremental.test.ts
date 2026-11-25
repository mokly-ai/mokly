import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  incrementalConfig,
  incrementalFixture,
} from "./fixtures/vite_incremental.js";
import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";
import { reportDuration } from "./helpers/durations.js";

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
