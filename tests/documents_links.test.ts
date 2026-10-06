import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { isPublicStaticFile } from "../dist/config/public_files.js";

import { pathFixture, pageSource } from "./helpers/path_fixture.js";

test("plain-text repository links remain protected source inputs in a nested root", async (t) => {
  const fixture = await pathFixture(
    {
      "generated/specs/guide.md": "# Guide\n\n[Source](helper.ts)",
      "generated/specs/helper.ts":
        "throw new Error('Never execute or serve this source')",
    },
    '{mockupsDir:"generated",roots:[{dir:"generated/specs"}]}',
  );
  t.after(fixture.remove);
  const config = await fixture.config();
  const { manifest } = await fixture.compile();
  assert.ok(manifest.sourceFiles.includes("generated/specs/helper.ts"));
  assert.equal(
    isPublicStaticFile(path.join(fixture.root, "generated/specs/helper.ts"), {
      ...config,
      sourceFiles: manifest.sourceFiles,
    }),
    false,
  );
});

test("file and logical links reach numeric and Unicode heading ids", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md":
      "# Guide\n\n[One](other.md#1-start) [Cafe](other.md#caf%C3%A9) [Direct](mock:other#café)",
    "specs/other.md": "# 1 Start\n\n## Café",
  });
  t.after(fixture.remove);
  const html = (await fixture.compile()).outputs.get(
    "guide/index.html",
  ) as string;
  assert.ok(html.includes('data-mokly-link="other#1-start"'));
  assert.equal((html.match(/data-mokly-link="other#café"/g) ?? []).length, 2);
});

test("an empty file-link fragment opens the target document", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md": "# Guide\n\n[Other](other.md#)",
    "specs/other.md": "# Other",
  });
  t.after(fixture.remove);
  const html = (await fixture.compile()).outputs.get(
    "guide/index.html",
  ) as string;
  assert.ok(html.includes('data-mokly-link="other"'));
});

test("relative resources normalize once and preserve URL encoding, queries and fragments", async (t) => {
  const fixture = await pathFixture({
    "specs/account/billing/README.md":
      "# Billing\n\n![Picture](../shared/a%20b.svg#shape)\n\n[Download](./statement.pdf?download=1)\n\n[Source](../../helper.ts)",
    "specs/account/shared/a b.svg":
      '<svg xmlns="http://www.w3.org/2000/svg"><g id="shape"/></svg>',
    "specs/account/billing/statement.pdf": "%PDF-1.0\n",
    "specs/helper.ts": 'export const secret = "not public";',
  });
  t.after(fixture.remove);
  const { outputs, manifest } = await fixture.compile();
  const html = outputs.get("account/billing/index.html") as string;
  assert.ok(html.includes('src="../shared/a%20b.svg#shape"'));
  assert.ok(html.includes('href="./statement.pdf?download=1"'));
  assert.ok(html.includes("<p>Source</p>"));
  assert.ok(outputs.has("account/shared/a b.svg"));
  assert.ok(outputs.has("account/billing/statement.pdf"));
  assert.ok(![...outputs.keys()].some((route) => route.includes("helper")));
  assert.ok(manifest.entries[0]!.kind === "document");
  assert.deepEqual(manifest.entries[0]!.resources, [
    "specs/account/billing/statement.pdf",
    "specs/account/shared/a b.svg",
  ]);
});

test("external destinations and same-document anchors retain their semantics", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md":
      "# Guide\n\n[Section](#section) [Site](https://example.com/a?q=1#part) [Mail](mailto:hello@example.com)\n\n![Remote](https://example.com/image.png)\n\n## Section",
  });
  t.after(fixture.remove);
  const html = (await fixture.compile()).outputs.get(
    "guide/index.html",
  ) as string;
  for (const value of [
    'href="#section"',
    'href="https://example.com/a?q=1#part"',
    'href="mailto:hello@example.com"',
    'src="https://example.com/image.png"',
  ])
    assert.ok(html.includes(value), value);
});

test("logical links to entries use the same final fragment and transformer checks", async (t) => {
  const fixture = await pathFixture({
    "specs/docs/README.md": "# Docs\n\n[Page](mock:../page#section)",
    "specs/page.mockup.ts": pageSource(
      "",
      '<html><body id="section">Page</body></html>',
    ),
  });
  t.after(fixture.remove);
  assert.ok(
    (
      (await fixture.compile()).outputs.get("docs/index.html") as string
    ).includes('data-mokly-link="page#section"'),
  );
  await fixture.write(
    "mokly.config.ts",
    'export default {mockupsDir:"generated",roots:[{dir:"specs"}],compatibility:{transformer:"transform.ts"}}',
  );
  await fixture.write(
    "transform.ts",
    'export default ({content,route}) => route === "page/index.html" ? content.replace(/id="section"/g, "") : content;',
  );
  await assert.rejects(fixture.compile(), /logical fragment section.*missing/);
});

for (const [destination, reason, extra] of [
  ["missing.md", "link target missing.md does not exist", {}],
  ["image.png", "link target image.png does not exist", {}],
  [
    "../outside.png",
    "resource ../outside.png is outside the root",
    { "outside.png": "outside" },
  ],
  [
    "../../outside.txt",
    "link target ../../outside.txt is outside the repository",
    {},
  ],
  [
    "javascript:alert(1)",
    "link target javascript:alert(1) is not a portable relative path",
    {},
  ],
  [
    "data:text/plain,hello",
    "link target data:text/plain,hello is not a portable relative path",
    {},
  ],
  ["/image.png", "link target /image.png is not a portable relative path", {}],
  [
    "//example.com/image.png",
    "link target //example.com/image.png is not a portable relative path",
    {},
  ],
  ["%00.png", "link target %00.png is not a portable relative path", {}],
  ["%ZZ.png", "link target %ZZ.png is not a portable relative path", {}],
  [
    "guide.md?extra=1",
    "link target guide.md?extra=1 must not contain a query",
    {},
  ],
] as const)
  test(`document rejects unsafe or absent destination: ${destination}`, async (t) => {
    const fixture = await pathFixture({
      "specs/guide.md": `# Guide\n\n[Target](<${destination}>)`,
      ...extra,
    });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), {
      code: "build-invalid",
      detail: `specs/guide.md: ${reason}`,
    });
  });

for (const [destination, detail] of [
  [
    "#missing",
    "document links and resources are invalid:\n- guide/index.html: missing anchor #missing",
  ],
  [
    "other.md#missing",
    "guide/index.html logical fragment missing for other is missing from document other/index.html",
  ],
  [
    "mock:missing",
    "[unknown-link-target] specs/guide.md: link target missing does not exist",
  ],
] as const)
  test(`document rejects missing fragment or logical entry: ${destination}`, async (t) => {
    const fixture = await pathFixture({
      "specs/guide.md": `# Guide\n\n[Target](${destination})`,
      "specs/other.md": "# Other",
    });
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), { code: "build-invalid", detail });
  });

test("resource confinement checks physical targets and rejects in-root aliases", async (t) => {
  const fixture = await pathFixture({
    "specs/guide.md": "# Guide\n\n![Image](alias.png)",
    "outside.png": "private",
    "specs/image.png": "image",
  });
  t.after(fixture.remove);
  const alias = path.join(fixture.root, "specs/alias.png");
  await fs.symlink("../outside.png", alias);
  await assert.rejects(
    fixture.compile(),
    /resource alias.png is outside the root/,
  );
  await fs.unlink(alias);
  await fs.symlink("image.png", alias);
  await assert.rejects(
    fixture.compile(),
    /resource alias.png must be a regular file without symlink aliases/,
  );
});

test("declared paths cannot make a resource escape the output", async (t) => {
  const fixture = await pathFixture({
    "specs/deep/guide.md":
      "---\npath: guide\n---\n# Guide\n\n![Image](../image.png)",
    "specs/image.png": "image",
  });
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /resource ..\/image.png is outside the output/,
  );
});

test("resource route collisions across roots fail before output writes", async (t) => {
  const fixture = await pathFixture(
    {
      "one/guide.md": "# Guide\n\n![Image](image.png)",
      "one/image.png": "one",
      "two/other.md": "# Other\n\n![Image](image.png)",
      "two/image.png": "two",
    },
    '{mockupsDir:"generated",roots:[{dir:"one"},{dir:"two"}]}',
  );
  t.after(fixture.remove);
  await assert.rejects(
    fixture.compile(),
    /collides with another generated resource at image.png/,
  );
});

for (const [files, pattern] of [
  [
    {
      "specs/account/README.md": "# First",
      "specs/account/index.md": "# Second",
    },
    /\[duplicate-index\] directory specs\/account has two index documents: README.md and index.md/,
  ],
  [
    { "specs/README.md": "# Root" },
    /has no folder to be the index of; give it a path/,
  ],
  [
    { "specs/Getting Started.md": "# Guide" },
    /file name "Getting Started" is not a valid path segment/,
  ],
  [
    { "specs/Bad Folder/guide.md": "# Guide" },
    /directory name "Bad Folder" is not a valid path segment/,
  ],
  [
    { "specs/guide.md": '---\ntags: ["Not Valid"]\n---\n# Guide' },
    /invalid-tags/,
  ],
  [
    { "specs/guide.md": '---\ntags: ["tag", "tag"]\n---\n# Guide' },
    /tags must not contain duplicates/,
  ],
  [
    { "specs/guide.md": "---\npath: ../guide\n---\n# Guide" },
    /path "..\/guide" is not a valid path/,
  ],
  [
    { "specs/guide.md": "---\nmovedFrom: ../guide\n---\n# Guide" },
    /movedFrom "..\/guide" is not a valid path/,
  ],
  [
    { "specs/guide.md": "---\nmovedFrom: guide\n---\n# Guide" },
    /equals the entry's own path/,
  ],
] as const)
  test(`document discovery and metadata failure: ${pattern}`, async (t) => {
    const fixture = await pathFixture(files);
    t.after(fixture.remove);
    await assert.rejects(fixture.compile(), pattern);
  });
