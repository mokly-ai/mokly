/**
 * A build without Changes writes only the catalogue's published files: the
 * index and the generated documents, and no source file, live Serve route,
 * or extensionless address that a static host could serve.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { runCaptured } from "../scripts/verification/process.mjs";

import { consumer, shim } from "./helpers/mokly_serve.js";

/** Every file under `root`, by its path from `root` with `/` separators. */
async function inventory(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(root, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    );
}

/** Whether nothing, not even a directory or a link, exists at `entry`. */
async function absent(entry: string): Promise<boolean> {
  try {
    await fs.lstat(entry);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

test(
  "a build without Changes holds the published files and no source, live route, or extensionless address",
  { timeout: 60_000 },
  async (context) => {
    const root = await consumer(context, {
      ".git/HEAD": "ref: refs/heads/main\n",
      "specs/screens/welcome.screen.html":
        "---\ntitle: Welcome\n---\n<h1>Welcome</h1>",
    });
    // The awaited runner leaves the event loop free, so the test timeout can
    // abort the build, and the runner then ends its whole process group.
    const built = await runCaptured(
      process.execPath,
      [shim, "build", "--no-changes", "--out", "output"],
      {
        cwd: root,
        env: { ...process.env, MOKLY_OUTPUT: "plain" },
        signal: context.signal,
      },
    );
    assert.equal(built.exitCode, 0, built.stderr);
    const files = await inventory(path.join(root, "output"));
    for (const file of [
      "mokly-viewer/index.json",
      "static/mokly-generated/screens/welcome/index.mobile.html",
    ])
      assert.equal(files.includes(file), true, file);
    for (const file of [
      "id/screens/welcome/index.html",
      "mokly.config.json",
      ".git/HEAD",
      "node_modules/react/package.json",
      "mokly-viewer/events",
      "mokly-viewer/live.json",
      "mokly-viewer/components/render",
      "mokly-viewer/index",
      "static/mokly-generated/screens/welcome/index.mobile",
    ])
      // No entry of any type: no file, no directory with an index document,
      // and no link at the address.
      assert.equal(await absent(path.join(root, "output", file)), true, file);
  },
);
