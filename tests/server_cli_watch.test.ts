import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
  validEntrySource,
} from "./helpers/fixture.js";
import {
  captureOutput,
  outputUrl,
  readEvent,
  sourceWithHomeRoute,
  streamEnded,
  waitFor,
} from "./server_fixture.js";

test(
  "watched CLI rebuilds, restarts on one stable port, and cleans up its child",
  { timeout: 45_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const child = spawn(
      process.execPath,
      [
        path.join(repositoryRoot, "dist/cli/bin.js"),
        "--config",
        fixture.configPath,
        "--port",
        "0",
        "--build",
      ],
      { cwd: fixture.root, stdio: ["ignore", "pipe", "pipe"] },
    );
    context.after(() => {
      if (!child.killed) child.kill("SIGTERM");
    });
    const stderr = captureOutput(child.stderr);
    const url = await outputUrl(child.stdout);
    const firstPort = new URL(url).port;
    const events = await fetch(`${url}/mokly-viewer/events`);
    const eventReader = events.body?.getReader();
    assert.ok(eventReader);
    assert.match(await readEvent(eventReader), /event: ready/);
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({ body: '<a href="mock:home">Home</a>' }),
    );
    let generated = path.join(
      fixture.mockupsDir,
      "mokly-generated/screens/home.desktop.html",
    );
    await waitFor(async () =>
      (await fs.promises.readFile(generated, "utf8")).includes(
        'data-mokly-link="home"',
      ),
    );
    assert.match(await readEvent(eventReader), /event: update/);
    assert.equal(new URL(url).port, firstPort);
    await waitFor(async () =>
      (
        await (
          await fetch(`${url}/static/mokly-generated/screens/home.desktop.html`)
        ).text()
      ).includes('data-mokly-link="home"'),
    );
    await fs.promises.writeFile(
      fixture.entryPath,
      sourceWithHomeRoute("screens/start.html", "Watched Home"),
    );
    generated = path.join(
      fixture.mockupsDir,
      "mokly-generated/screens/start.desktop.html",
    );
    await waitFor(async () =>
      (await fs.promises.readFile(generated, "utf8")).includes("Watched Home"),
    );
    assert.equal(await streamEnded(eventReader), true);
    await waitFor(
      async () =>
        (await (await fetch(`${url}/view/screens/start.html`)).text()).includes(
          "Watched Home",
        ),
      20_000,
    );
    assert.match(
      await (
        await fetch(`${url}/static/mokly-generated/screens/start.desktop.html`)
      ).text(),
      /data-mokly-link="details"/,
    );
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({
        body: `<a href="mock:missing-screen">Broken</a>`,
        firstTitle: "Broken Home",
      }),
    );
    await waitFor(async () => stderr().includes("unknown id: missing-screen"));
    assert.match(await fs.promises.readFile(generated, "utf8"), /Watched Home/);
    assert.equal((await fetch(url)).status, 200);
    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({ firstTitle: "Recovered Home" }),
    );
    generated = path.join(
      fixture.mockupsDir,
      "mokly-generated/screens/home.desktop.html",
    );
    await waitFor(async () =>
      (await fs.promises.readFile(generated, "utf8")).includes(
        "Recovered Home",
      ),
    );
    await waitFor(async () => (await fetch(url)).status === 200);
    await fs.promises.writeFile(
      fixture.configPath,
      `export default { entriesDir: "entries", mockupsDir: "mockups", repoRoot: ".", review: { base: "config-reloaded", outDir: ".review" } };\n`,
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
