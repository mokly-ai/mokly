import assert from "node:assert/strict";
import path from "node:path";

import { files } from "./static_faults.js";
import { command } from "./static_publication.js";

export function exportCategory(stderr: string) {
  assert.deepEqual(
    stderr.match(/\[mokly\/[^\]]+\]/gu),
    ["[mokly/export-invalid]"],
    stderr,
  );
}

export function causes(stderr: string, primary: string, cleanup: string) {
  assert.ok(
    stderr.includes(primary),
    `Missing primary cause ${primary}:\n${stderr}`,
  );
  assert.ok(
    stderr.includes(cleanup),
    `Missing cleanup cause ${cleanup}:\n${stderr}`,
  );
  assert.ok(stderr.indexOf(primary) < stderr.indexOf(cleanup), stderr);
}

export function unsafe(path: string) {
  return `Unexpected or unsafe output entry at ${path}.`;
}

export function recoveryPath(
  root: string,
  output: string,
  verb: "build" | "publish",
) {
  return verb === "build" ? path.relative(root, output) : output;
}

export function normalized(
  stderr: string,
  root: string,
  output: string,
  verb: "build" | "publish",
) {
  return (
    verb === "publish"
      ? stderr.replaceAll(path.dirname(output), "{private}")
      : stderr
  )
    .replaceAll(root, "{root}")
    .split(path.sep)
    .join("/");
}

export async function installedBytes(
  root: string,
  output: string,
  verb: "build" | "publish",
) {
  const built = await command(root, "build", [
    "--no-changes",
    "--out=.context/expected",
  ]).result;
  assert.equal(built.code, 0, built.stderr);
  const expected = await files(path.join(root, ".context/expected"));
  const actual = await files(output);
  if (verb === "publish") {
    assert.ok(actual.delete("mokly-upload.json"));
    const marker = ".mokly-export-artifact";
    const inventory = JSON.parse(actual.get(marker)!.toString()) as {
      schemaVersion: number;
      files: Array<{ path: string; sha256: string; size: number }>;
    };
    assert.equal(
      inventory.files.filter(({ path }) => path === "mokly-upload.json").length,
      1,
    );
    inventory.files = inventory.files.filter(
      ({ path }) => path !== "mokly-upload.json",
    );
    assert.deepEqual(inventory, JSON.parse(expected.get(marker)!.toString()));
    actual.set(marker, expected.get(marker)!);
  }
  assert.deepEqual(actual, expected);
}
