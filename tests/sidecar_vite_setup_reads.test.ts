import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";
import type { ReviewFixture } from "./fixtures/vite_review.js";

async function setupGate(context: TestContext) {
  const server = createServer();
  const arrival = new Promise<ServerResponse>((resolve) =>
    server.once("request", (_request, response) => resolve(response)),
  );
  context.after(() => {
    server.close();
    server.closeAllConnections();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    arrival,
    wait: `await fetch('http://127.0.0.1:${address.port}/')`,
  };
}

async function rejectSetupEdit(
  fixture: ReviewFixture,
  gate: Awaited<ReturnType<typeof setupGate>>,
  file: string,
  edit: () => Promise<void>,
) {
  const bundle = fixture.compile();
  const response = await Promise.race([gate.arrival, bundle]);
  assert.ok("end" in response, "setup must reach the gate before it completes");
  try {
    await edit();
  } finally {
    response.end();
  }
  await assert.rejects(bundle, (error: Error) => {
    assert.ok(error.message.includes(file), error.message);
    assert.match(error.message, /changed during compilation/);
    return true;
  });
}

test("Vite rejects a head dotenv edit after Vite reads it", async (context) => {
  const fixture = await reviewFixture(context);
  const gate = await setupGate(context);
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage("import.meta.env.VITE_COPY"),
  );
  await fixture.write(".env", "VITE_COPY=before\n");
  await fixture.write(
    "vite.config.mjs",
    `export default { plugins: [{ name: 'gate', async configResolved() { ${gate.wait}; } }] };`,
  );

  await rejectSetupEdit(fixture, gate, ".env", () =>
    fixture.write(".env", "VITE_COPY=after\n"),
  );
});

test("Vite rejects a working dotenv edit between the base config and Vite reads", async (context) => {
  const fixture = await reviewFixture(context, "base");
  const gate = await setupGate(context);
  const [workingRoot] = fixture.params.repositoryRoots;
  assert.ok(workingRoot);
  fixture.params.viteInputs = {
    rebuildFiles: [],
    baseEnv: { workingRoot, indexed: [], pinned: [], links: {} },
  };
  const env = path.relative(fixture.root, path.join(workingRoot, ".env"));
  await fixture.write(env, "VITE_COPY=before\n");
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage("__COPY__ + import.meta.env.VITE_COPY"),
  );
  await fixture.write(
    "vite.config.mjs",
    `import { loadEnv } from 'vite';
export default async () => {
  const early = loadEnv('development', process.cwd()).VITE_COPY;
  ${gate.wait};
  return { define: { __COPY__: JSON.stringify(early) } };
};`,
  );

  await rejectSetupEdit(fixture, gate, ".env", () =>
    fixture.write(env, "VITE_COPY=after\n"),
  );
});

test("Vite keeps base dotenv reads outside envDir out of render identity", async (context) => {
  const head = await reviewFixture(context);
  const base = await reviewFixture(context, "base");
  const [workingRoot] = base.params.repositoryRoots;
  assert.ok(workingRoot);
  base.params.viteInputs = {
    rebuildFiles: [],
    baseEnv: { workingRoot, indexed: [], pinned: [], links: {} },
  };
  await base.write(
    path.relative(base.root, path.join(workingRoot, ".env")),
    "VITE_EXTRA=freshness\n",
  );
  for (const fixture of [head, base]) {
    await fixture.write("src/review.mockup.ts", reviewPage('"entry"'));
    await fixture.write(
      "vite.config.mjs",
      `import { loadEnv } from 'vite';
loadEnv('development', process.cwd());
export default { envDir: 'env' };`,
    );
  }
  const headRecipe = (await head.compile()).compiled.vite;
  const baseRecipe = (await base.compile()).compiled.vite;
  assert.ok(headRecipe?.setupDigest);
  assert.equal(baseRecipe?.setupDigest, headRecipe.setupDigest);
  const extra = baseRecipe.envInputs?.find(({ name }) => name === ".env");
  assert.equal(extra?.file, path.join(workingRoot, ".env"));
  assert.equal(extra.working, true);
  assert.equal(extra.render, false);
  await head.sidecar.call("shutdown");
  await base.sidecar.call("shutdown");
});

for (const [file, edited] of [
  ["vite.config.mjs", "export default {};"],
  ["copy.json", '{"copy":"after"}'],
  ["vite.config.js", "export default {};"],
] as const) {
  test(`Vite rejects a change to ${file} during config setup`, async (context) => {
    const fixture = await reviewFixture(context);
    const gate = await setupGate(context);
    await fixture.write("src/review.mockup.ts", reviewPage("__COPY__"));
    await fixture.write("copy.json", '{"copy":"before"}');
    await fixture.write(
      "vite.config.mjs",
      `import data from './copy.json';
export default async () => {
  ${gate.wait};
  return { define: { __COPY__: JSON.stringify(data.copy) } };
};`,
    );

    await rejectSetupEdit(fixture, gate, file, () =>
      fixture.write(file, edited),
    );
  });
}
