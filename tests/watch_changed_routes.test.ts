import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
  validEntrySource,
} from "./helpers/fixture.js";
import { waitUntil } from "./helpers/wait_until.js";
import { waitForClassifiedCount } from "./helpers/watched_catalogue.js";

const execFileAsync = promisify(execFile);
const cli = path.join(repositoryRoot, "dist/cli/bin.js");

test(
  "content-only watched rebuilds refresh changed routes without restart",
  { timeout: 30_000 },
  async (context) => {
    const fixture = await createFixture();
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    await git(fixture.root, "init", "-q", "-b", "main");
    await git(fixture.root, "config", "user.name", "Mokly Test");
    await git(fixture.root, "config", "user.email", "mokly@example.invalid");
    await git(fixture.root, "add", ".");
    await git(fixture.root, "commit", "-qm", "test: baseline");

    const child = spawn(
      process.execPath,
      [cli, "--config", fixture.configPath, "--base", "main", "--port", "0"],
      { cwd: fixture.root, stdio: ["ignore", "pipe", "pipe"] },
    );
    context.after(async () => {
      await stopChild(child);
      await removeFixture(fixture);
    });
    const url = await listeningUrl(child);
    const initial = await waitForClassifiedCount(url, 0);
    assert.match(initial, /class="mbk-nav-filter-count">0</);
    const events = await fetch(`${url}/__mokly/events`);
    const reader = events.body?.getReader();
    assert.ok(reader);
    assert.match(await readEvent(reader), /event: ready/);

    await fs.promises.writeFile(
      fixture.entryPath,
      validEntrySource({
        body: '<a href="mock:details">Updated details link</a>',
      }),
    );
    assert.match(await readEvent(reader), /event: update/);
    await waitFor(async () => {
      const html = await (await fetch(url)).text();
      return (
        html.includes('class="mbk-nav-filter-count">2') &&
        html.includes('data-changed="true"')
      );
    });
    await reader.cancel();
  },
);

test(
  "stylesheet reloads disable invalid Changes input and recover after repair",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await changedFixture(
      context,
      validEntrySource(),
      {
        extraConfig:
          'stylesheets: [{ match: "home/index.html", stylesheets: ["home.css"] }],',
      },
      async ({ mockupsDir }) => {
        await fs.promises.writeFile(
          path.join(mockupsDir, "home.css"),
          "body {}",
        );
      },
    );
    const child = spawn(
      process.execPath,
      [cli, "--config", fixture.configPath, "--base", "main", "--port", "0"],
      { cwd: fixture.root, stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      const url = await listeningUrl(child);
      assert.match(
        await waitForClassifiedCount(url, 0),
        /class="mbk-nav-filter-count">0</,
      );
      const events = await fetch(`${url}/__mokly/events`);
      const reader = events.body?.getReader();
      assert.ok(reader);
      try {
        assert.match(await readEvent(reader), /event: ready/);
        await fs.promises.writeFile(
          path.join(fixture.mockupsDir, "home.css"),
          '@import "/invalid.css";',
        );
        assert.match(await readEvent(reader), /event: update/);
        await waitFor(async () => {
          const html = await (await fetch(url)).text();
          return html.includes('data-changes-status="unavailable"');
        });
        assert.equal((await fetch(`${url}/view/home/`)).status, 200);
        await fs.promises.writeFile(
          path.join(fixture.mockupsDir, "home.css"),
          "body { color: red; }",
        );
        assert.match(await readEvent(reader), /event: update/);
        await waitFor(async () => {
          const html = await (await fetch(url)).text();
          return html.includes('class="mbk-nav-filter-count">2');
        });
        await assert.rejects(fs.promises.access(fixture.config.review.outDir), {
          code: "ENOENT",
        });
      } finally {
        await reader.cancel();
      }
    } finally {
      await stopChild(child);
    }
  },
);

async function git(cwd: string, ...arguments_: string[]): Promise<void> {
  await execFileAsync("git", arguments_, { cwd });
}

function listeningUrl(child: ChildProcess): Promise<string> {
  child.stderr?.resume();
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error(`serve readiness timed out: ${output}`)),
      15_000,
    );
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const url = output.match(
        /Mokly listening at (http:\/\/127\.0\.0\.1:\d+)/,
      )?.[1];
      if (!url) return;
      clearTimeout(timer);
      resolve(url);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`serve exited before readiness (${String(code)})`));
    });
  });
}

async function readEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder();
  let output = "";
  while (!output.includes("\n\n")) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error("event stream ended before an event");
    output += decoder.decode(chunk.value, { stream: true });
  }
  return output;
}

async function waitFor(condition: () => Promise<boolean>): Promise<void> {
  await waitUntil(condition, {
    timeoutMs: 15_000,
    intervalMs: 50,
    message: "changed routes did not refresh",
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}
