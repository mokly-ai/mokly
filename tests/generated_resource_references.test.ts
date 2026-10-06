import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { auditGeneratedResourceReferences } from "./helpers/generated_resource_references.js";

async function site(
  context: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-resource-audit-"),
  );
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
  return root;
}

async function failures(
  context: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string[]> {
  return (await auditGeneratedResourceReferences(await site(context, files)))
    .failures;
}

test("missing link, srcset, url() and @import targets fail", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "screens/home.html": [
        '<link rel="stylesheet" href="../styles/site.css">',
        '<link rel="stylesheet" href="../styles/gone.css">',
        '<img src="../assets/logo.png" srcset="../assets/logo.png 1x, ../assets/logo@2x.png 2x">',
      ].join(""),
      "styles/site.css": [
        '@import "./base.css";',
        '@import "./gone-import.css";',
        ".a { background: url(../assets/logo.png); }",
        '.b { background: url("../assets/gone.png"); }',
      ].join("\n"),
      "styles/base.css": "body { margin: 0; }",
      "assets/logo.png": "png",
    }),
    [
      "screens/home.html: ../assets/logo@2x.png (missing file)",
      "screens/home.html: ../styles/gone.css (missing file)",
      "styles/site.css: ../assets/gone.png (missing file)",
      "styles/site.css: ./gone-import.css (missing file)",
    ],
  );
});

test("HTML values that the shared rule rejects fail with its reason", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "index.html": [
        '<link rel="icon" href="/favicon.ico">',
        '<img src="//cdn.example.com/a.png">',
        '<iframe src="about:blank"></iframe>',
        '<object data="file:///tmp/chart.svg"></object>',
        '<img src="../outside.png">',
        '<img src="%E0%A4%A.png">',
      ].join(""),
    }),
    [
      "index.html: %E0%A4%A.png (invalid URL encoding)",
      "index.html: ../outside.png (outside the generated root)",
      "index.html: //cdn.example.com/a.png (protocol-relative)",
      "index.html: /favicon.ico (root-absolute)",
      "index.html: about:blank (unsupported scheme)",
      "index.html: file:///tmp/chart.svg (unsupported scheme)",
    ],
  );
});

test("the file type selects the shared rule, as in the build", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "styles/site.css": [
        ".a { background: url(//cdn.example.com/font.woff2); }",
        ".b { fill: url(#gradient); }",
        ".c { background: url(/root.png); }",
      ].join("\n"),
      "index.html": [
        '<div style="background: url(//cdn.example.com/x.png)"></div>',
        "<style>.d { background: url(//cdn.example.com/y.png); }</style>",
      ].join(""),
    }),
    [
      "index.html: //cdn.example.com/x.png (protocol-relative)",
      "index.html: //cdn.example.com/y.png (protocol-relative)",
      "styles/site.css: /root.png (root-absolute)",
    ],
  );
});

test("encoded paths, queries, fragments and same-document values resolve as in the build", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "index.html": [
        '<link rel="stylesheet" href="%40scope/theme.css?v=2#top">',
        '<svg><use href="sprite.svg#icon"></use><use href="#local"></use>',
        '<image href="missing.svg"></image></svg>',
        '<link rel="preload" href="font%20file.woff2">',
        '<img src="?variant=2">',
      ].join(""),
      "@scope/theme.css": "",
      "sprite.svg": "<svg></svg>",
      "font file.woff2": "font",
    }),
    ["index.html: missing.svg (missing file)"],
  );
});

test("external values and navigation links are ignored", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "index.html": [
        '<img src="" srcset="data:image/png;base64,AA,BB 1x, https://cdn.example.com/a.png 2x">',
        '<link rel="stylesheet" href="https://example.com/site.css">',
        '<a href="missing-page.html">Anchors are not resources</a>',
        '<div style="background: url(data:image/gif;base64,R0lG)"></div>',
      ].join(""),
    }),
    [],
  );
});

test("the audit counts HTML files and the local references it checked", async (context) => {
  const audit = await auditGeneratedResourceReferences(
    await site(context, {
      "one.html": '<link rel="stylesheet" href="a.css"><img src="#x">',
      "nested/two.html":
        '<link rel="stylesheet" href="../a.css"><link rel="icon" href="../a.css">',
      "a.css": ".a { background: url(https://example.com/x.png); }",
    }),
  );
  assert.deepEqual(audit, { failures: [], htmlFiles: 2, localReferences: 3 });
});
