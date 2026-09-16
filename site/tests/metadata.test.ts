import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  availableSocialImages,
  canonicalUrl,
  socialImagePath,
  socialSlug,
  socialImageUrl,
} from "../src/metadata.js";

test("canonical URLs resolve every route against the site origin", () => {
  assert.equal(
    canonicalUrl("/", "https://example.com"),
    "https://example.com/",
  );
  assert.equal(
    canonicalUrl("/docs/", "https://example.com"),
    "https://example.com/docs/",
  );
  assert.equal(
    canonicalUrl("/terms/", "http://localhost:4321"),
    "http://localhost:4321/terms/",
  );
});

test("the social card slug names the route", () => {
  assert.equal(socialSlug("/"), "index");
  assert.equal(socialSlug("/docs/"), "docs");
  assert.equal(socialSlug("/docs/start/install/"), "docs-start-install");
  assert.equal(socialSlug("/404"), "404");
  assert.equal(socialImagePath("/changelog/"), "/og/changelog.png");
});

test("a card image is advertised only once the build produced it", () => {
  const origin = "https://example.com";
  assert.equal(socialImageUrl("/docs/", origin, new Set()), undefined);
  assert.equal(
    socialImageUrl("/docs/", origin, new Set(["docs"])),
    "https://example.com/og/docs.png",
  );
  assert.equal(
    socialImageUrl("/", origin, new Set(["docs"])),
    undefined,
    "an unrelated card never stands in for another route",
  );
});

test("reading the card directory tolerates an absent or mixed set", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-site-og-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(availableSocialImages(path.join(root, "og")), new Set());
  await mkdir(path.join(root, "og"));
  await writeFile(path.join(root, "og", "index.png"), "");
  await writeFile(path.join(root, "og", "notes.txt"), "");
  assert.deepEqual(
    availableSocialImages(path.join(root, "og")),
    new Set(["index"]),
  );
});
