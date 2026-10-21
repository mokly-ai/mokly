import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { baseManagerFixture } from "./helpers/base_manager_fixture.js";
import { managers } from "./helpers/base_manager_tools.js";
import { git, write } from "./helpers/static_changes.js";
import { command } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test(
  "a cold Yarn Classic base installs ordinary versions from its committed offline mirror",
  { timeout: 120_000 },
  async (context) => {
    const fixture = await baseManagerFixture(managers[1], context);
    const { root } = fixture;
    const workingManifest = await fs.readFile(path.join(root, "package.json"));
    const workingLock = await fs.readFile(path.join(root, "yarn.lock"));
    const baseManifest = await git(root, "show", "HEAD:package.json");
    await write(
      root,
      "package.json",
      baseManifest.replace("file:vendor/dependency-1.0.0.tgz", "1.0.0"),
    );
    const archive = await fs.readFile(
      path.join(root, "vendor/dependency-1.0.0.tgz"),
    );
    const hash = createHash("sha1").update(archive).digest("hex");
    await write(
      root,
      "yarn.lock",
      `# yarn lockfile v1\n\n"mokly-cold-dependency@1.0.0":\n  version "1.0.0"\n  resolved "https://registry.invalid/mokly-cold-dependency/-/mokly-cold-dependency-1.0.0.tgz#${hash}"\n`,
    );
    await write(root, ".yarnrc", 'yarn-offline-mirror "./offline"\n');
    await fs.mkdir(path.join(root, "offline"));
    await fs.writeFile(
      path.join(root, "offline/mokly-cold-dependency-1.0.0.tgz"),
      archive,
    );
    await git(root, "add", "-A");
    await git(root, "commit", "-qm", "offline mirror base fixture");
    await fs.writeFile(path.join(root, "package.json"), workingManifest);
    await fs.writeFile(path.join(root, "yarn.lock"), workingLock);
    const external = path.join(root, ".context/external-mirror");
    await fs.mkdir(external);
    assert.deepEqual(await fs.readdir(fixture.cache), []);
    const result = await command(
      root,
      "build",
      ["--base=HEAD", "--out=.context/site", "--sidecars=1", "--debug-timings"],
      "plain",
      { ...fixture.env, yarn_yarn_offline_mirror: external },
      context.signal,
    ).result;
    assert.equal(result.code, 0, result.stderr);
    assert.equal(await fs.readFile(fixture.network, "utf8"), "");
    assert.deepEqual(await fs.readdir(external), []);
    const span = timings(result.stderr).find(
      (record) =>
        record.stage === "review.base-dependencies" && record.event === "end",
    );
    if (span?.tier !== 2)
      context.diagnostic(await fs.readFile(fixture.managerOutput, "utf8"));
    assert.equal(span?.tier, 2, result.stderr);
    assert.doesNotMatch(result.stderr, /base dependencies at/u);
    assert.equal(
      (await fs.readFile(fixture.calls, "utf8")).trim().split("\n").length,
      1,
    );
  },
);
