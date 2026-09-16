import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import { checkLinks } from "../scripts/links/check.js";

const origin = "https://mokly.example";

async function output(
  t: TestContext,
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mokly-site-links-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return root;
}

test("links resolve nested routes, fragments, assets and frames", async (t) => {
  const root = await output(t, {
    "index.html": `<main id="main"></main>
      <a href="#main">Main</a><a href="#top">Top</a>
      <a href="/docs?view=all#A%20%26%20B">Docs</a>
      <a href="${origin}/docs/">Absolute</a>
      <a href="//mokly.example/docs/#A%20%26%20B">Relative protocol</a>
      <a href="https://external.example/missing#missing">External</a>
      <a href="mailto:hello@example.com">Email</a><a href="tel:123">Phone</a>
      <img src="data:image/png;base64,AA==" alt="" />
      <iframe title="Screen" src="/frames/screen.html#screen"></iframe>
      <object data="/image.svg#mark"></object>`,
    "docs/index.html": `<h1 id="A &amp; B">Docs</h1>
      <a href="../">Home</a><a href="?q=x&amp;sort=y#A%20%26%20B">Self</a>
      <a href="#A%20%26%20B:~:text=Docs">Text fragment</a>
      <a name="old"></a><a href="#old">Legacy anchor</a>
      <link rel="stylesheet" href="../assets/site.css?v=1" />
      <img src="../image.svg" srcset="../image.svg 1x, ../image%20large.svg 2x" alt="" />
      <source srcset="data:image/png;base64,AA== 1x, ../image.svg 2x" />
      <link rel="preload" as="image" imagesrcset="../image.svg 1x" />
      <video poster="../image.svg"><source src="../movie.mp4" /></video>
      <script src="../assets/script.js"></script>
      <style>.art { background: url('../image.svg'); }</style>
      <div style="background-image: url('../image.svg')"></div>`,
    "frames/screen.html":
      '<h1 id="screen">Screen</h1><img src="../image.svg" alt="" />',
    "assets/site.css":
      '@import "./theme.css"; .art { background: url("../image.svg"); filter: url(#local-filter); }',
    "assets/theme.css":
      "/* url(missing.svg) */ .art::after { content: 'url(missing.svg)'; }",
    "assets/script.js": "",
    "image.svg":
      '<svg xmlns="http://www.w3.org/2000/svg"><g id="mark" /></svg>',
    "image large.svg": "<svg></svg>",
    "movie.mp4": "",
  });
  assert.ok((await checkLinks(root, origin)) > 20);
});

test("base href changes relative URL resolution", async (t) => {
  const root = await output(t, {
    "index.html": '<base href="/docs/"><a href="guide/#intro">Guide</a>',
    "docs/guide/index.html": '<h1 id="intro">Guide</h1>',
  });
  await checkLinks(root, origin);
});

test("documentation anchors resolve on the page and across pages", async (t) => {
  const root = await output(t, {
    "docs/cli/serve/index.html": `<main id="main">
      <nav><a href="#usage">Usage</a><a href="#options">Options</a></nav>
      <h2 id="usage">Usage</h2><h2 id="options">Options</h2>
      <a href="../build/#what-it-writes">What build writes</a>
      <a href="/docs/">Documentation</a></main>`,
    "docs/cli/build/index.html":
      '<main id="main"><h2 id="what-it-writes">What it writes</h2></main>',
    "docs/index.html": '<main id="main"><h1>Documentation</h1></main>',
  });
  assert.equal(await checkLinks(root, origin), 4);
});

test("fails when a documentation page links to a heading that moved", async (t) => {
  const root = await output(t, {
    "docs/cli/serve/index.html": '<a href="../build/#renamed">Build</a>',
    "docs/cli/build/index.html": '<h2 id="what-it-writes">What it writes</h2>',
  });
  await assert.rejects(
    checkLinks(root, origin),
    /missing anchor #renamed in docs\/cli\/build\/index.html/,
  );
});

for (const [name, html, message] of [
  ["href", '<a href="/missing/">Missing</a>', "missing file"],
  [
    "same-origin URL",
    `<a href="${origin}/missing/">Missing</a>`,
    "missing file",
  ],
  ["anchor", '<a href="/docs/#absent">Missing</a>', "missing anchor"],
  ["image", '<img src="/missing.png" />', "missing file"],
  [
    "responsive image",
    '<img srcset="/image.svg 1x, /missing.png 2x" />',
    "missing file",
  ],
  ["frame", '<iframe src="/missing.html"></iframe>', "missing file"],
  ["frame anchor", '<iframe src="/docs/#missing"></iframe>', "missing anchor"],
  [
    "stylesheet",
    '<link href="/missing.css" rel="stylesheet" />',
    "missing file",
  ],
  ["script", '<script src="/missing.js"></script>', "missing file"],
  [
    "inline CSS",
    "<style>p { background: url(/missing.svg); }</style>",
    "missing file",
  ],
  ["poster", '<video poster="/missing.jpg"></video>', "missing file"],
  ["object", '<object data="/missing.pdf"></object>', "missing file"],
  ["malformed encoding", '<a href="/%zz">Invalid</a>', "malformed"],
  ["malformed anchor", '<a href="#%zz">Invalid</a>', "malformed"],
  [
    "encoded traversal",
    '<img src="/%2e%2e%2fsecret.png" />',
    "invalid output path",
  ],
  [
    "unsupported scheme",
    '<a href="file:///etc/passwd">Invalid</a>',
    "unsupported",
  ],
] as const) {
  test(`fails on a broken ${name}`, async (t) => {
    const root = await output(t, {
      "index.html": html,
      "docs/index.html": "<h1>Docs</h1>",
      "image.svg": "<svg></svg>",
    });
    await assert.rejects(
      checkLinks(root, origin),
      new RegExp(`index.html:.*${message}`),
    );
  });
}

test("reports all missing CSS imports, fonts and images", async (t) => {
  const root = await output(t, {
    "index.html": '<link href="/assets/site.css" rel="stylesheet" />',
    "assets/site.css":
      '@import "missing.css"; @font-face { font-family: test; src: url(font.woff2); } p { background: url(missing.svg); }',
  });
  await assert.rejects(checkLinks(root, origin), (error: Error) => {
    for (const file of ["missing.css", "font.woff2", "missing.svg"])
      assert.ok(error.message.includes(file));
    return true;
  });
});

test("fails without built HTML or with a missing output directory", async (t) => {
  const root = await output(t, {});
  await assert.rejects(checkLinks(root, origin), /no HTML/);
  await assert.rejects(
    checkLinks(path.join(root, "missing"), origin),
    /ENOENT/,
  );
});

test("the CLI returns nonzero and names the failing document", async (t) => {
  const root = await output(t, {
    "index.html": '<a href="/missing/">Missing</a>',
  });
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/check-links.mjs", root],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        env: { ...process.env, SITE_ORIGIN: origin, SITE_STAGE_PR: "71" },
        timeout: 30_000,
      },
    ),
    (error: Error & { code?: number; stderr?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr ?? "", /index.html.*missing file/);
      return true;
    },
  );
});
