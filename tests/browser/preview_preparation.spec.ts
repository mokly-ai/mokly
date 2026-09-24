import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { REAL_EXPORT_FIXTURE_TIMEOUT_MS } from "./fixture_timeouts.js";
import { startPreviewFixture } from "./preview_fixture.js";

test("the real preview build preserves generated output and serves fresh publication bytes", async ({
  page,
}) => {
  test.setTimeout(REAL_EXPORT_FIXTURE_TIMEOUT_MS);
  const before = await generatedDigest();
  const preview = await startPreviewFixture();
  try {
    expect(await generatedDigest()).toBe(before);
    expect(preview.freshness.outputWasAbsent).toBe(true);
    await page.goto(`${preview.url}/view/screens/welcome`);
    await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  } finally {
    await preview.close();
  }
});

async function generatedDigest(): Promise<string> {
  const root = path.join(repositoryRoot, "examples/basic/.generated");
  const hash = crypto.createHash("sha256");
  for (const relative of (await fs.readdir(root, { recursive: true })).sort()) {
    const file = path.join(root, relative);
    if ((await fs.stat(file)).isFile()) {
      hash.update(relative);
      hash.update(await fs.readFile(file));
    }
  }
  return hash.digest("hex");
}
