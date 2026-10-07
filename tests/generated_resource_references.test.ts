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

test("missing stylesheet, srcset, url() and @import targets fail", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "screens/home.html": [
        '<link rel="stylesheet" href="../styles/site.css">',
        '<link rel="stylesheet" href="../styles/gone.css">',
        '<link rel="canonical" href="../not-a-resource.html">',
        '<img src="../assets/logo.png" srcset="../assets/logo.png 1x, ../assets/logo@2x.png 2x">',
      ].join(""),
      "styles/site.css": [
        '@import "./base.css";',
        '@import url("./gone-import.css") screen;',
        ".a { background: url(../assets/logo.png); }",
        '.b { background: url("../assets/gone.png"); }',
      ].join("\n"),
      "styles/base.css": "body { margin: 0; }",
      "assets/logo.png": "png",
    }),
    [
      "screens/home.html: img[srcset] ../assets/logo@2x.png (missing file)",
      "screens/home.html: link[href] ../styles/gone.css (missing file)",
      "styles/site.css: @import ./gone-import.css (missing file)",
      "styles/site.css: url() ../assets/gone.png (missing file)",
    ],
  );
});

test("root-absolute values and values outside the root fail", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "index.html": [
        '<link rel="icon" href="/favicon.ico">',
        '<img src="../outside.png">',
        '<video src="clip.mp4" poster="../poster.png"></video>',
        '<object data="/chart.svg"></object>',
        '<input type="image" src="../button.png">',
      ].join(""),
      "clip.mp4": "video",
    }),
    [
      "index.html: img[src] ../outside.png (outside the generated root)",
      "index.html: input[src] ../button.png (outside the generated root)",
      "index.html: link[href] /favicon.ico (root-absolute)",
      "index.html: object[data] /chart.svg (root-absolute)",
      "index.html: video[poster] ../poster.png (outside the generated root)",
    ],
  );
});

test("percent-encoded paths, queries and fragments resolve to the file", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "index.html": [
        '<link rel="stylesheet" href="%40scope/theme.css?v=2#top">',
        '<svg><use xlink:href="sprite.svg#icon"></use><image href="missing.svg"></image></svg>',
        '<link rel="preload" href="font%20file.woff2">',
      ].join(""),
      "@scope/theme.css": "",
      "sprite.svg": "<svg></svg>",
      "font file.woff2": "font",
    }),
    ["index.html: image[href] missing.svg (missing file)"],
  );
});

test("data, scheme, protocol-relative and fragment-only values are ignored", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "index.html": [
        '<img src="" srcset="data:image/png;base64,AA,BB 1x, //cdn.example.com/a.png 2x">',
        '<link rel="stylesheet" href="https://example.com/site.css">',
        '<iframe src="about:blank"></iframe>',
        '<svg><use href="#icon"></use></svg>',
        '<a href="missing-page.html">Anchors are not resources</a>',
        '<div style="background: url(data:image/gif;base64,R0lG)"></div>',
      ].join(""),
      "styles.css": ".a { background: url(#gradient); }",
    }),
    [],
  );
});

test("<style> elements and style attributes are checked", async (context) => {
  assert.deepEqual(
    await failures(context, {
      "index.html": [
        '<style>@import "gone.css"; .a { background: url(gone.png); }</style>',
        "<div style=\"background-image: url('absent.png')\"></div>",
      ].join(""),
    }),
    [
      "index.html: <style> @import gone.css (missing file)",
      "index.html: <style> url() gone.png (missing file)",
      "index.html: [style] url() absent.png (missing file)",
    ],
  );
});

test("the audit counts the HTML files and stylesheet links it read", async (context) => {
  const audit = await auditGeneratedResourceReferences(
    await site(context, {
      "one.html": '<link rel="stylesheet" href="a.css">',
      "nested/two.html":
        '<link rel="stylesheet" href="../a.css"><link rel="icon" href="../a.css">',
      "a.css": "",
    }),
  );
  assert.deepEqual(audit, { failures: [], htmlFiles: 2, stylesheetLinks: 2 });
});

test("generated resources resolve the authored closure without auditing private files", async (context) => {
  const root = await site(context, {
    "mokly-generated/home/index.html":
      '<link rel="stylesheet" href="../../styles/theme.css"><img src="../../logo.png">',
    "styles/theme.css":
      '@import "./base.css"; .a { background: url(../logo.png); }',
    "styles/base.css": "body { margin: 0; }",
    "logo.png": "png",
    "specs/private.html": '<img src="not-public.png">',
  });
  const audit = await auditGeneratedResourceReferences(root, [
    "mokly-generated/home/index.html",
    "styles/theme.css",
    "styles/base.css",
    "logo.png",
  ]);
  assert.deepEqual(audit, { failures: [], htmlFiles: 1, stylesheetLinks: 1 });
});

test("selected authored styles retain missing-resource and root-confinement checks", async (context) => {
  const root = await site(context, {
    "mokly-generated/home.html": '<link rel="stylesheet" href="../theme.css">',
    "theme.css":
      '@import "missing.css"; .a { background: url(../outside.png); }',
  });
  const audit = await auditGeneratedResourceReferences(root, [
    "mokly-generated/home.html",
    "theme.css",
  ]);
  assert.deepEqual(audit.failures, [
    "theme.css: @import missing.css (missing file)",
    "theme.css: url() ../outside.png (outside the generated root)",
  ]);
});
