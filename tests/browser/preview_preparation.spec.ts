import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { expect, test as base } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";
import { timeFixturePhase } from "../helpers/fixture_timing.js";

import { startPreviewFixture } from "./preview_fixture.js";
import type { OwnedPreviewFixture } from "./preview_fixture_owner.js";

interface PreparedPreview {
  readonly before: string;
  readonly after: string;
  readonly preview: OwnedPreviewFixture;
}

const PREVIEW_PREPARATION_SETUP_TIMEOUT_MS = 420_000;

const test = base.extend<{ preparedPreview: PreparedPreview }>({
  preparedPreview: [
    async ({ browserName: _browserName }, use) => {
      const before = await timeFixturePhase(
        "preview-preparation",
        "digest-before",
        false,
        generatedDigest,
      );
      const preview = await startPreviewFixture();
      try {
        const after = await timeFixturePhase(
          "preview-preparation",
          "digest-after",
          false,
          generatedDigest,
        );
        await use({ before, after, preview });
      } finally {
        await timeFixturePhase("preview-preparation", "teardown", false, () =>
          preview.close(),
        );
      }
    },
    { timeout: PREVIEW_PREPARATION_SETUP_TIMEOUT_MS },
  ],
});

test("the real preview build preserves generated output and serves fresh publication bytes", async ({
  page,
  preparedPreview: { before, after, preview },
}) => {
  expect(after).toBe(before);
  expect(preview.freshness.outputWasAbsent).toBe(true);
  await page.goto(`${preview.url}/view/screens/welcome`);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
});

async function generatedDigest(): Promise<string> {
  const root = path.join(repositoryRoot, "examples/basic/generated");
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
