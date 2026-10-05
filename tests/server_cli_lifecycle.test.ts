import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createFixture,
  removeFixture,
  validEntrySource,
  cliBinPath,
} from "./helpers/fixture.js";
import {
  captureOutput,
  outputUrl,
  readEvent,
  sourceWithHomeRoute,
  streamEnded,
  waitFor,
} from "./helpers/server_http.js";

test("CLI no-watch lifecycle becomes ready and exits cleanly on SIGTERM", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const child = spawn(
    process.execPath,
    [
      cliBinPath,
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
    await (await fetch(`${url}/static/home/index.desktop.html`)).text(),
    /id="home"/,
  );
  await waitFor(async () =>
    fs.existsSync(path.join(fixture.mockupsDir, "mokly-manifest.json")),
  );
  child.kill("SIGTERM");
  const code = await new Promise<number | null>((resolve) =>
    child.once("exit", resolve),
  );
  assert.equal(code, 0);
  assert.equal(
    fs.existsSync(path.join(fixture.mockupsDir, "mokly-manifest.json")),
    true,
  );
});

test(
  "watched CLI rebuilds, restarts on one stable port, and cleans up its child",
  { timeout: 45_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const child = spawn(
      process.execPath,
      [cliBinPath, "--config", fixture.configPath, "--port", "0"],
      { cwd: fixture.root, stdio: ["ignore", "pipe", "pipe"] },
    );
    context.after(() => {
      if (!child.killed) child.kill("SIGTERM");
    });
    const stderr = captureOutput(child.stderr);
    const url = await outputUrl(child.stdout);
    const firstPort = new URL(url).port;
    const events = await fetch(`${url}/__mokly/events`);
    const eventReader = events.body?.getReader();
    assert.ok(eventReader);
    assert.match(await readEvent(eventReader), /event: ready/);
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({ body: '<a href="mock:home">Home</a>' }),
    );
    let generated = path.join(fixture.mockupsDir, "home/index.desktop.html");
    await waitFor(async () =>
      (await fs.promises.readFile(generated, "utf8")).includes(
        'data-mokly-link="home"',
      ),
    );
    assert.match(await readEvent(eventReader), /event: update/);
    assert.equal(new URL(url).port, firstPort);
    await waitFor(async () =>
      (
        await (await fetch(`${url}/static/home/index.desktop.html`)).text()
      ).includes('data-mokly-link="home"'),
    );
    await fs.promises.writeFile(
      fixture.entryPath,
      sourceWithHomeRoute("start/index.html", "Watched Home"),
    );
    generated = path.join(fixture.mockupsDir, "start/index.desktop.html");
    await waitFor(async () =>
      (await fs.promises.readFile(generated, "utf8")).includes("Watched Home"),
    );
    assert.equal(await streamEnded(eventReader), true);
    await waitFor(
      async () =>
        (await (await fetch(`${url}/view/start/`)).text()).includes(
          "Watched Home",
        ),
      20_000,
    );
    assert.match(
      await (await fetch(`${url}/static/start/index.desktop.html`)).text(),
      /data-mokly-link="details"/,
    );
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({
        body: `<a href="mock:missing-screen">Broken</a>`,
        firstTitle: "Broken Home",
      }),
    );
    await waitFor(async () =>
      stderr().includes("link target missing-screen does not exist"),
    );
    assert.match(await fs.promises.readFile(generated, "utf8"), /Watched Home/);
    assert.equal((await fetch(url)).status, 200);
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({ firstTitle: "Recovered Home" }),
    );
    generated = path.join(fixture.mockupsDir, "home/index.desktop.html");
    await waitFor(async () =>
      (await fs.promises.readFile(generated, "utf8")).includes(
        "Recovered Home",
      ),
    );
    await waitFor(async () => (await fetch(url)).status === 200);
    await fs.promises.writeFile(
      fixture.configPath,
      `export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: ".", review: { base: "config-reloaded", outDir: ".review" } };\n`,
    );
    await waitFor(
      async () =>
        (await (await fetch(url)).text()).includes(
          'data-mokly-base="config-reloaded"',
        ),
      20_000,
    );
    assert.equal(new URL(url).port, firstPort);
    child.kill("SIGTERM");
    assert.equal(
      await new Promise<number | null>((resolve) =>
        child.once("exit", resolve),
      ),
      0,
    );
    await assert.rejects(() => fetch(url));
  },
);
