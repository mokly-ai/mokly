import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { MANIFEST_NAME } from "../dist/registry/manifest.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

test(
  "watched child uses retained manifest and reports readiness before requesting its full runtime",
  { timeout: 10_000 },
  async (context) => {
    const fixture = await createFixture(componentEntrySource());
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    await fs.writeFile(
      path.join(fixture.mockupsDir, MANIFEST_NAME),
      "invalid stale manifest\n",
    );
    const childBin = path.join(repositoryRoot, "dist/cli/bin.js");
    const childArguments = [
      "__serve-child",
      "--config",
      fixture.configPath,
      "--retained-runtime",
      "--port",
      "0",
    ];
    const child = fork(childBin, childArguments, {
      cwd: fixture.root,
      execArgv: [],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    context.after(async () => {
      await stopChild(child);
      await removeFixture(fixture);
    });
    assert.deepEqual(child.spawnargs, [
      process.execPath,
      childBin,
      ...childArguments,
    ]);
    const messages: unknown[] = [];
    child.on("message", (message) => messages.push(message));

    const first = await waitForMessage(messages, 0);
    assert.equal(
      (first as { type?: unknown }).type,
      "component-runtime-startup-request",
    );
    child.send({
      config,
      manifest: compilation.manifest,
      type: "component-runtime-startup",
    });

    const ready = await waitForMessage(messages, 1);
    assert.equal((ready as { type?: unknown }).type, "ready");
    const port = (ready as { port?: unknown }).port;
    assert.equal(typeof port, "number");
    const request = await waitForMessage(messages, 2);
    assert.equal(
      (request as { type?: unknown }).type,
      "component-runtime-request",
    );

    child.send({
      runtime: componentRuntime(compilation),
      type: "component-runtime",
      version: 2,
    });
    const html = await waitForRuntime(`http://127.0.0.1:${String(port)}`);
    assert.match(html, /data-mokly-update-version="2"/);
    assert.match(html, /"renderCapability"/);
  },
);

async function waitForMessage(
  messages: readonly unknown[],
  index: number,
): Promise<unknown> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (messages.length > index) return messages[index];
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`child did not send message ${String(index + 1)}`);
}

async function waitForRuntime(url: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const html = await (
      await fetch(`${url}/view/components/action.html`)
    ).text();
    if (html.includes('data-mokly-update-version="2"')) return html;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("child did not publish its retained runtime");
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) =>
    child.once("exit", () => resolve()),
  );
  child.kill("SIGTERM");
  await exited;
}
