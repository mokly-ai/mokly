import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pathFixture } from "./helpers/path_fixture.js";

for (const directory of [
  ".assets",
  "node_modules",
  "target",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
])
  test(`resource resolution rejects export-private names: ${directory}`, async (t) => {
    const destination = `${directory}/a.png`;
    const fixture = await pathFixture({
      "specs/guide.md": `# Guide\n\n![Image](${destination})`,
      [`specs/${destination}`]: "image bytes",
    });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      detail: `specs/guide.md: resource ${destination} ${directory.startsWith(".") ? "contains a hidden path segment" : `is inside a private build or dependency directory (${directory})`}`,
    });
  });

for (const destination of [
  "helper.ts/x.png",
  `${"a".repeat(300)}.png`,
  "dangling.png",
])
  test(`filesystem failures have the attributed missing-target text: ${destination}`, async (t) => {
    const fixture = await pathFixture({
      "specs/guide.md": `# Guide\n\n[File](<${destination}>)`,
      "specs/helper.ts": "export default 1;",
    });
    t.after(fixture.remove);
    if (destination === "dangling.png")
      await fs.symlink(
        "missing.png",
        path.join(fixture.root, "specs/dangling.png"),
      );
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      detail: `specs/guide.md: link target ${destination} does not exist`,
    });
  });

for (const destination of ["MOCK:other", "folder\\a.png"])
  test(`nonportable destination reports its exact authoring error: ${destination}`, async (t) => {
    const fixture = await pathFixture({
      "specs/guide.md": `# Guide\n\n[File](<${destination}>)`,
      "specs/other.md": "# Other",
    });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      detail: `specs/guide.md: link target ${destination} is not a portable relative path`,
    });
  });

test("image references to documents and source files use their alternative text", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md":
      "# Guide\n\n![Read the other document](other.md)\n\n![Read the source](helper.ts)",
    "specs/other.md": "# Other",
    "specs/helper.ts": "throw new Error('This file must never be imported')",
  });
  t.after(fixture.remove);
  const { outputs } = await fixture.compile();
  const html = outputs.get("guide/index.html") as string;
  assert.match(
    html,
    /<a [^>]*data-mokly-link="other"[^>]*>Read the other document<\/a>/,
  );
  assert.ok(html.includes("<p>Read the source</p>"));
  assert.ok(!html.includes("<img"));
});

test("character references resolve to real resource filenames once", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md":
      "# Guide\n\n![Image](a&amp;b.png)\n\n![Literal](a&amp;amp;b.png)",
    "specs/a&b.png": "decoded",
    "specs/a&amp;b.png": "literal",
  });
  t.after(fixture.remove);
  const { outputs } = await fixture.compile();
  assert.deepEqual(
    outputs.get("a&b.png"),
    new Uint8Array(Buffer.from("decoded")),
  );
  assert.deepEqual(
    outputs.get("a&amp;b.png"),
    new Uint8Array(Buffer.from("literal")),
  );
});

test("resources cannot enter the package-owned output namespace", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md": "# Guide\n\n![Image](mokly-generated/a.png)",
    "specs/mokly-generated/a.png": "image",
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), {
    code: "build-invalid",
    detail:
      "specs/guide.md: resource mokly-generated/a.png is outside the output",
  });
});

test("a configured root alias may supply a regular document resource", async (t) => {
  const fixture = await pathFixture(
    {
      "source/guide.md": "# Guide\n\n![Image](a.png)",
      "source/a.png": "image",
    },
    '{mockupsDir:"generated",roots:[{dir:"alias"}]}',
  );
  t.after(fixture.remove);
  await fs.symlink("source", path.join(fixture.root, "alias"));
  const { outputs } = await fixture.compile();
  assert.deepEqual(outputs.get("a.png"), new Uint8Array(Buffer.from("image")));
});

test("case-only index directory conflicts use the shared path-collision diagnostic", async (t) => {
  const fixture = await pathFixture({
    "specs/Guides/README.md": "# Upper",
    "specs/guides/README.md": "# Lower",
  });
  t.after(fixture.remove);
  await assert.rejects(fixture.compile(), {
    code: "build-invalid",
    detail:
      "catalogue is invalid:\n- [case-collision] paths Guides and guides differ only by letter case:\n  specs/Guides/README.md\n  specs/guides/README.md",
  });
});
