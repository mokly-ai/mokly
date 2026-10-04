import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { Agent } from "node:http";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";
import { nodeRequest, outputUrl, readEvent } from "./server_fixture.js";

test("server validates before bind and supports safe no-watch routes on port zero", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await assert.rejects(async () => {
    const invalid = await startCatalogueServer(config, {
      base: "origin/main",
      port: 0,
      manifest: {} as never,
    });
    fixture.beforeRemove(() => invalid.close());
  }, /manifest must contain an entries array/);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    generatedOutputs: compilation.outputs,
    port: 0,
  });
  fixture.beforeRemove(() => server.close());
  assert.ok(server.port > 0);
  const home = await fetch(`${server.url}/`);
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /data-mokly-shell/);
  assert.match(homeHtml, /aria-label="Catalogue"/);
  assert.match(homeHtml, /Browse the mockup catalogue/);
  const shellCss = await fetch(`${server.url}/mokly-viewer/shell.css`);
  assert.equal(shellCss.status, 200);
  assert.match(await shellCss.text(), /--mokly-accent/);
  const removedAlias = await fetch(`${server.url}/id/home`, {
    redirect: "manual",
  });
  assert.equal(removedAlias.status, 404);
  assert.match(await removedAlias.text(), /Item not found/);
  assert.equal(
    (await fetch(`${server.url}/view/screens/home.html`)).status,
    200,
  );
  assert.equal(
    (
      await fetch(
        `${server.url}/static/mokly-generated/screens/home.mobile.html`,
      )
    ).status,
    200,
  );
  assert.equal(
    (await fetch(`${server.url}/static/mokly-generated/mokly-manifest.json`))
      .status,
    404,
  );
  assert.equal(
    (await fetch(`${server.url}/static/entries/fixture.mockup.tsx`)).status,
    404,
  );
  const events = await fetch(`${server.url}/mokly-viewer/events`);
  const eventReader = events.body?.getReader();
  assert.ok(eventReader);
  assert.match(await readEvent(eventReader), /event: ready\ndata: 1/);
  server.publishUpdate({ version: 2 });
  assert.match(await readEvent(eventReader), /event: update\ndata: 2/);
  await eventReader.cancel();
  assert.equal(
    (await fetch(`${server.url}/static/%252e%252e/package.json`)).status,
    404,
  );
  assert.equal((await fetch(`${server.url}/view/unknown.html`)).status, 404);
});

test("strict occupied ports fail without disturbing the existing server", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const first = await startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
  });
  fixture.beforeRemove(() => first.close());
  await assert.rejects(
    () =>
      startCatalogueServer(config, {
        base: "origin/main",
        port: first.port,
        strictPort: true,
      }),
    /could not bind port/,
  );
  assert.equal((await fetch(first.url)).status, 200);
});

test("event-stream HEAD releases a keep-alive connection", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, {
    base: "origin/main",
    port: 0,
  });
  fixture.beforeRemove(() => server.close());
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  context.after(() => agent.destroy());

  const head = await nodeRequest(
    `${server.url}/mokly-viewer/events`,
    "HEAD",
    agent,
  );
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
  const home = await nodeRequest(`${server.url}/`, "GET", agent);
  assert.equal(home.status, 200);
  assert.match(home.body, /data-mokly-shell/);
});

test("malformed manifest identities fail before server readiness", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const manifestPath = path.join(
    fixture.mockupsDir,
    "mokly-generated/mokly-manifest.json",
  );
  const manifest = JSON.parse(
    await fs.promises.readFile(manifestPath, "utf8"),
  ) as {
    entries: Array<{ id: string; kind: string }>;
  };
  const screen = manifest.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen);
  screen.id = "../outside";
  await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(async () => {
    const invalid = await startCatalogueServer(config, {
      base: "origin/main",
      port: 0,
      manifest: manifest as never,
    });
    fixture.beforeRemove(() => invalid.close());
  }, /invalid manifest id/);
});

test("manifest relationships retain their required entry kinds", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const manifestPath = path.join(
    fixture.mockupsDir,
    "mokly-generated/mokly-manifest.json",
  );
  const manifest = JSON.parse(
    await fs.promises.readFile(manifestPath, "utf8"),
  ) as {
    entries: Array<{
      id: string;
      kind: string;
      steps?: Array<{ screenId: string }>;
      useCaseIds?: string[];
    }>;
  };
  const useCase = manifest.entries.find((entry) => entry.kind === "use-case");
  assert.ok(useCase?.steps?.[0]);
  useCase.steps = [{ screenId: "fixture" }];
  for (const entry of manifest.entries) {
    if (entry.kind === "screen") entry.useCaseIds = [];
  }
  await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(async () => {
    const invalid = await startCatalogueServer(config, {
      base: "origin/main",
      port: 0,
      manifest: manifest as never,
    });
    fixture.beforeRemove(() => invalid.close());
  }, /step target is not a screen/);
});

test("CLI no-watch lifecycle becomes ready and exits cleanly on SIGTERM", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const child = spawn(
    process.execPath,
    [
      path.join(repositoryRoot, "dist/cli/bin.js"),
      "serve",
      "--config",
      fixture.configPath,
      "--port",
      "0",
      "--no-watch",
    ],
    { cwd: fixture.root, stdio: ["ignore", "pipe", "pipe"] },
  );
  context.after(() => {
    if (!child.killed) child.kill("SIGTERM");
  });
  const url = await outputUrl(child.stdout);
  assert.equal((await fetch(url)).status, 200);
  assert.match(
    await (
      await fetch(`${url}/static/mokly-generated/screens/home.desktop.html`)
    ).text(),
    /id="home"/,
  );
  assert.equal(
    fs.existsSync(
      path.join(fixture.mockupsDir, "mokly-generated/mokly-manifest.json"),
    ),
    false,
  );
  child.kill("SIGTERM");
  const code = await new Promise<number | null>((resolve) =>
    child.once("exit", resolve),
  );
  assert.equal(code, 0);
  assert.equal(
    fs.existsSync(
      path.join(fixture.mockupsDir, "mokly-generated/mokly-manifest.json"),
    ),
    false,
  );
});
