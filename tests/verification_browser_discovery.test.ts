import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { discoverBrowserTests } from "../scripts/verification/playwright.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const LOAD_SENTINEL = "browser discovery load sentinel";

test("a failed browser discovery reports Playwright's load errors", async () => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/browser-discovery-"),
  );
  try {
    await writeMiniatureProject(root);
    await assert.rejects(
      discoverBrowserTests(root),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("Playwright discovery failed (1)") &&
        error.message.includes(LOAD_SENTINEL),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function writeMiniatureProject(root: string): Promise<void> {
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const files = new Map([
    [
      "playwright.config.mjs",
      `export default {
  outputDir: ${JSON.stringify(path.join(root, "playwright-output"))},
  projects: [{ name: "chromium" }],
  testDir: "tests/browser",
};
`,
    ],
    [
      "tests/browser/broken.spec.ts",
      `import { test } from "@playwright/test";

throw new Error(${JSON.stringify(LOAD_SENTINEL)});

test("never registered", () => {});
`,
    ],
  ]);
  for (const [name, contents] of files) {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
}
