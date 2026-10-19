import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { platformPackage } from "../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../packages/mokly/src/runtime.mjs";
import { object } from "../packages/viewer/src/catalogue/values.js";
import { prepareToolchain } from "../scripts/large/toolchain.js";
import { NATIVE_TARGETS } from "../scripts/release/targets.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const run = promisify(execFile);

test(
  "isolated install locks every native target and installs only the host",
  {
    timeout: 120_000,
  },
  async (t) => {
    const scratch = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/large-install-"),
    );
    t.after(() => fs.rm(scratch, { recursive: true, force: true }));
    const repository = path.join(scratch, "repository");
    const consumer = path.join(scratch, "consumer");
    await fs.mkdir(consumer);
    const host = platformPackage(
      process.platform,
      process.arch,
      systemRuntime().glibc,
    );
    const writePackage = async (name: string, manifest: object) => {
      const directory = path.join(
        repository,
        "packages",
        name.slice("@mokly/".length),
      );
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({
          name,
          version: "0.14.0",
          ...manifest,
        }),
      );
      return directory;
    };
    await writePackage("@mokly/viewer", {});
    await writePackage("@mokly/mokly", {
      dependencies: { "@mokly/viewer": "0.14.0" },
      optionalDependencies: Object.fromEntries(
        NATIVE_TARGETS.map(({ name }) => [name, "0.14.0"]),
      ),
    });
    for (const target of NATIVE_TARGETS) {
      const directory = await writePackage(target.name, {
        os: [target.os],
        cpu: [target.cpu],
        ...(target.libc ? { libc: [target.libc] } : {}),
        files: [`bin/${target.executable}`],
      });
      if (target.name === host) {
        await fs.mkdir(path.join(directory, "bin"));
        await fs.writeFile(
          path.join(directory, "bin", target.executable),
          "host binary fixture",
        );
      }
    }
    await fs.writeFile(
      path.join(repository, "package-lock.json"),
      JSON.stringify({
        packages: {
          "node_modules/@firna/ui": { version: "1.0.0", peerDependencies: {} },
        },
      }),
    );
    const result = await prepareToolchain(
      repository,
      consumer,
      "install",
      async (file, args, settings) => {
        if (args[0] === "install") {
          const filename = path.join(consumer, "package.json");
          const manifest = object(
            JSON.parse(await fs.readFile(filename, "utf8")),
          );
          // Isolate native optional resolution from unrelated registry dependencies.
          delete object(manifest.dependencies)["@firna/ui"];
          await fs.writeFile(filename, JSON.stringify(manifest));
        }
        return run(file, [...args, "--offline"], {
          ...settings,
          env: {
            ...process.env,
            npm_config_cache: path.join(scratch, "npm-cache"),
          },
        });
      },
    );
    assert.equal(result.mode, "install");
    const lock = object(
      JSON.parse(
        await fs.readFile(path.join(consumer, "package-lock.json"), "utf8"),
      ),
    );
    const packages = object(lock.packages);
    for (const target of NATIVE_TARGETS) {
      const entry = object(packages[`node_modules/${target.name}`]);
      assert.equal(entry.version, "0.14.0");
      assert.match(String(entry.resolved), /^file:tooling\//);
      const installed = path.join(
        consumer,
        "node_modules",
        target.name,
        "package.json",
      );
      if (target.name === host) await fs.access(installed);
      else {
        assert.equal(entry.optional, true);
        await assert.rejects(fs.access(installed), { code: "ENOENT" });
      }
    }
  },
);
