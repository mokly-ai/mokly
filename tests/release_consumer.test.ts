import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { installConsumer } from "../scripts/release/smoke_consumer.mjs";
import {
  NATIVE_TARGETS,
  releasePackages,
} from "../scripts/release/targets.mjs";

test("the release consumer installs the host platform, CLI, viewer, and UI archives", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-consumer-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const host = NATIVE_TARGETS.find(
    ({ os: system, cpu }) =>
      system === process.platform && cpu === process.arch,
  );
  assert.ok(host, "the consumer smoke requires a supported host");
  const packages = releasePackages().map(({ name, artifact }) => ({
    archivePath: path.join(root, "archives", `${artifact}.tgz`),
    report: { name, version: "0.16.1" },
  }));
  const commands: string[] = [];
  await installConsumer(root, packages, async (file, args, options) => {
    assert.equal(file, "npm");
    assert.equal(options.cwd, root);
    commands.push(args[0]!);
    if (args[0] === "install") {
      const manifest = JSON.parse(
        await fs.readFile(path.join(root, "package.json"), "utf8"),
      );
      for (const name of Object.keys(manifest.dependencies)) {
        const installed = path.join(root, "node_modules", name);
        await fs.mkdir(installed, { recursive: true });
        await fs.writeFile(
          path.join(installed, "package.json"),
          JSON.stringify({ name, version: "0.16.1" }),
        );
      }
    }
    return { stdout: "", stderr: "" };
  });
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  assert.deepEqual(
    manifest.dependencies,
    Object.fromEntries(
      [host.name, "@mokly/ui", "@mokly/viewer", "@mokly/mokly"].map((name) => [
        name,
        `file:${packages.find(({ report }) => report.name === name)!.archivePath}`,
      ]),
    ),
  );
  assert.deepEqual(commands, ["install", "audit"]);
});
