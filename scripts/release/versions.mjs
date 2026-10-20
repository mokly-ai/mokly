import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { NATIVE_TARGETS } from "./targets.mjs";

/** All release-owned version edges, including the private local native links. */
export async function verifyPackageVersions(root) {
  const json = async (file) =>
    JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
  const [workspace, lock, cli, viewer, versions] = await Promise.all([
    json("package.json"),
    json("package-lock.json"),
    json("packages/mokly/package.json"),
    json("packages/viewer/package.json"),
    json(".release-please-manifest.json"),
  ]);
  assert.equal(workspace.private, true);
  for (const value of [
    workspace.version,
    lock.version,
    lock.packages[""].version,
    lock.packages["packages/mokly"].version,
    versions["."],
  ])
    assert.equal(value, cli.version, "CLI release versions must agree");
  for (const value of [
    workspace.devDependencies["@mokly/viewer"],
    lock.packages[""].devDependencies["@mokly/viewer"],
    cli.dependencies["@mokly/viewer"],
    lock.packages["packages/mokly"].dependencies["@mokly/viewer"],
    lock.packages["packages/viewer"].version,
    versions["packages/viewer"],
  ])
    assert.equal(value, viewer.version, "viewer release versions must agree");
  for (const { name, directory } of NATIVE_TARGETS) {
    assert.equal(
      (await json(`${directory}/package.json`)).version,
      cli.version,
      name,
    );
    assert.equal(lock.packages[directory].version, cli.version, name);
    assert.equal(cli.optionalDependencies[name], cli.version, name);
    assert.equal(
      lock.packages["packages/mokly"].optionalDependencies[name],
      cli.version,
      name,
    );
    assert.equal(
      workspace.optionalDependencies[name],
      `file:${directory}`,
      name,
    );
    assert.equal(
      lock.packages[""].optionalDependencies[name],
      `file:${directory}`,
      name,
    );
    assert.deepEqual(lock.packages[`node_modules/${name}`], {
      resolved: directory,
      link: true,
    });
  }
  return { cli, viewer };
}
