import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  command,
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./static_publication.js";

const exec = promisify(execFile);
export async function recoveryFixture() {
  const root = await publicationFixture();
  const result = await command(root, "build", [
    "--no-changes",
    "--out=.context/previous",
  ]).result;
  assert.equal(result.code, 0, result.stderr);
  await fs.writeFile(
    path.join(root, "specs/home.screen.html"),
    "---\ntitle: Home\n---\n<h1>New site</h1>",
  );
  await exec("git", ["add", "."], { cwd: root });
  await exec("git", ["commit", "-qm", "new site"], { cwd: root });
  return root;
}
export function faultCommand(
  root: string,
  verb: "build" | "publish",
  faults: string,
  mode = "plain",
  extra: NodeJS.ProcessEnv = {},
  output = ".context/site",
) {
  const env = {
    MOKLY_TEST_STATIC_FAULTS: faults,
    MOKLY_TEST_STATIC_COLUMNS: "500",
    MOKLY_TEST_STATIC_EVENTS: path.join(root, ".context/events"),
    MOKLY_TEST_STATIC_PREVIOUS: path.join(root, ".context/previous"),
    MOKLY_TEST_STATIC_READY: path.join(root, ".context/ready"),
    ...extra,
  };
  return verb === "publish"
    ? publish(root, "http://127.0.0.1:1/plan", mode, { env })
    : command(root, "build", ["--no-changes", `--out=${output}`], mode, env);
}
export function outputDirectory(
  root: string,
  verb: "build" | "publish",
  stdout: string,
) {
  return verb === "publish"
    ? directory(stdout)
    : path.join(root, ".context/site");
}
export function reservation(output: string) {
  return path.join(
    path.dirname(output),
    ".mokly-export-reservations/locks",
    path.basename(output),
  );
}
export async function files(root: string): Promise<Map<string, Buffer>> {
  const result = new Map<string, Buffer>();
  const walk = async (directory: string) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else result.set(path.relative(root, file), await fs.readFile(file));
    }
  };
  await walk(root);
  return result;
}
export async function cleanup(
  root: string,
  verb: "build" | "publish",
  output?: string,
) {
  if (verb === "publish" && output) await removeOutput(output);
  await fs.rm(root, { recursive: true, force: true });
}
