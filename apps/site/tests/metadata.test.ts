import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  NOT_FOUND_ROUTE,
  PAGE_METADATA,
  availableSocialImages,
  canonicalUrl,
  socialImagePath,
  socialSlug,
  socialImageUrl,
} from "../src/metadata.js";
import { SITE_PATHS } from "../src/navigation.js";

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

test("every route publishes a title and a description", () => {
  assert.deepEqual(Object.keys(PAGE_METADATA), [
    ...Object.values(SITE_PATHS),
    NOT_FOUND_ROUTE,
  ]);
  const titles = new Set<string>();
  for (const [route, { description, title }] of Object.entries(PAGE_METADATA)) {
    assert.ok(title.length > 0, route);
    assert.ok(description.length > 0 && description.length <= 180, route);
    assert.ok(!titles.has(title), `${route} repeats the title ${title}`);
    titles.add(title);
  }
  assert.equal(PAGE_METADATA[SITE_PATHS.home].title, "Mokly");
});
