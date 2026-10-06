import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { parseChildWarningMessage } from "../dist/server/update_messages.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

test(
  "a full-manifest child forwards startup config warnings without terminal output",
  { timeout: 10000 },
  async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        'review: { outDir: ".review" }',
        'review: { outDir: ".review", sharedImpact: undefined }',
      ),
    );
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const child = fork(
      path.join(repositoryRoot, "dist/cli/bin.js"),
      ["__serve-child", "--config", fixture.configPath, "--port", "0"],
      {
        cwd: fixture.root,
        execArgv: [],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    const exited = once(child, "exit");
    const closed = once(child, "close");
    const stop = async () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
      await closed;
    };
    fixture.beforeRemove(stop);
    let stderr = "";
    child.stderr!.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const warnings: unknown[] = [];
    const ready = new Promise<void>((resolve) =>
      child.on("message", (message) => {
        if (parseChildWarningMessage(message)) warnings.push(message);
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "ready"
        )
          resolve();
      }),
    );
    await Promise.race([
      ready,
      exited.then(() => assert.fail(`child exited: ${stderr}`)),
    ]);
    await stop();
    assert.equal(warnings.length, 1, stderr);
    assert.deepEqual(
      parseChildWarningMessage(warnings[0])!.warning,
      config.diagnostics![0],
    );
    assert.doesNotMatch(stderr, /\[mokly\/warning\]/);
  },
);
