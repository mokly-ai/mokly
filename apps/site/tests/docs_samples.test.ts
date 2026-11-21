import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { parse } from "parse5";

import { GUIDE_CONTENT } from "../src/docs/pages.js";
import { sampleFence, sampleTransformer } from "../src/docs/sample-fence.js";
import { sampleLines } from "../src/docs/sample-lines.js";
import { samplePath } from "../src/docs/sample-path.js";
import { sitePath } from "../src/workspace.js";

import {
  attribute,
  byClass,
  elements,
  one,
  textContent,
} from "./helpers/html.js";

function guideSample(): string {
  const guide = readFileSync(
    path.join(GUIDE_CONTENT, "start/your-first-screen.md"),
    "utf8",
  );
  const match = /^```html(?: sample=[^\n]+)?\n([\s\S]*?)\n```/mu.exec(guide);
  assert.ok(match?.[1], "the installed guide has an HTML fence");
  return match[1];
}

test("sample metadata accepts only one path below specs with the screen suffix", () => {
  for (const [meta, expected] of [
    ["sample=specs/welcome.screen.html", "specs/welcome.screen.html"],
    ["sample=specs/account/home.screen.html", "specs/account/home.screen.html"],
    ["sample=welcome.screen.html", undefined],
    ["sample=specs/welcome.html", undefined],
    ["sample=specs//a.screen.html", undefined],
    ["sample=specs/./a.screen.html", undefined],
    ["sample=specs/../a.screen.html", undefined],
    ["sample=/specs/a.screen.html", undefined],
    ["sample=specs\\a.screen.html", undefined],
    ["sample=", undefined],
    ["sample=specs/a.screen.html extra", undefined],
  ] as const)
    assert.equal(samplePath(meta), expected, meta);
});

test("sample lines map to authored elements across closing tags and multiline elements", () => {
  assert.deepEqual(sampleLines(guideSample()).lines, [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    11,
    12,
    13,
    14,
    15,
    11,
  ]);
  const source =
    "---\ntitle: Inline\n---\n\n<main><b>One</b><i>Two</i>\n  <p>\n    Three\n  </p>\n  <template><span>Four</span></template>\n</main>";
  const marked = sampleLines(source);
  assert.deepEqual(marked.lines, [null, null, null, null, 5, 6, 6, 6, 9, 5]);
  assert.ok(
    marked.source.includes(
      '<template data-sample-line="9"><span data-sample-line="9">',
    ),
  );
  const unquoted = sampleLines("---\ntitle: Input\n---\n\n<input value=a/>");
  assert.ok(
    unquoted.source.includes('<input data-sample-line="5" value=a/>'),
    unquoted.source,
  );
});

test("the built first-screen guide has a numbered sample and four script-free views", () => {
  const document = parse(
    readFileSync(
      sitePath("dist/docs/start/your-first-screen/index.html"),
      "utf8",
    ),
  );
  const band = one(document, "site-docs-sample");
  const head = one(band, "site-docs-sample-head");
  assert.equal(attribute(head, "aria-hidden"), "true");
  assert.equal(textContent(one(head, "site-docs-sample-name")), "Welcome");
  assert.equal(textContent(one(head, "site-chip")), "welcome");
  const panel = one(band, "site-docs-sample-code");
  assert.equal(byClass(panel, "site-code--numbered").length, 1);
  assert.equal(textContent(one(panel, "site-code-tab")), "welcome.screen.html");
  assert.equal(textContent(one(panel, "site-code-meta")), "specs");
  assert.equal(textContent(one(panel, "site-code-language")), "html");
  one(panel, "site-code-copy-slot");
  const pre = elements(panel, (element) => element.tagName === "pre");
  assert.equal(pre.length, 1);
  assert.equal(attribute(pre[0]!, "data-sample-meta"), undefined);
  assert.equal(textContent(pre[0]!), guideSample());
  const lines = byClass(panel, "site-code-line");
  assert.deepEqual(
    lines.map((line) => attribute(line, "data-line")),
    [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
    ],
  );
  assert.deepEqual(
    byClass(panel, "site-code-line--dim").map((line) =>
      attribute(line, "data-line"),
    ),
    ["15"],
  );
  assert.equal(attribute(lines[15]!, "data-sample-line"), "11");
  // The band keeps Shiki's tokens: the heading's tag names keep their colour.
  const tokens = elements(lines[11]!, (element) => element !== lines[11]);
  const tags = tokens.filter((token) => textContent(token) === "h1");
  assert.equal(tags.length, 2);
  assert.notEqual(attribute(tags[0]!, "style"), attribute(tokens[0]!, "style"));
  const views = byClass(band, "site-docs-sample-frame");
  assert.deepEqual(
    views.map((view) => [
      attribute(view, "data-viewport"),
      attribute(view, "data-state"),
      attribute(view, "data-state-title"),
      attribute(view, "data-dimmed"),
      attribute(view, "hidden"),
    ]),
    [
      ["mobile", "welcome", "Welcome", "15", undefined],
      ["desktop", "welcome", "Welcome", "14", ""],
      ["mobile", "welcome/first-visit", "First visit", "13 15", ""],
      ["desktop", "welcome/first-visit", "First visit", "13 14", ""],
    ],
  );
  const frames = views.map((view) => one(view, "site-docs-sample-screen"));
  assert.deepEqual(
    frames.map((frame) => [
      frame.tagName,
      attribute(frame, "title"),
      attribute(frame, "sandbox"),
      attribute(frame, "width"),
      attribute(frame, "height"),
      attribute(frame, "loading"),
    ]),
    [
      [
        "iframe",
        "Welcome, Mobile, Welcome",
        "allow-same-origin",
        "390",
        "844",
        "lazy",
      ],
      [
        "iframe",
        "Welcome, Desktop, Welcome",
        "allow-same-origin",
        "1280",
        "800",
        "lazy",
      ],
      [
        "iframe",
        "Welcome, Mobile, First visit",
        "allow-same-origin",
        "390",
        "844",
        "lazy",
      ],
      [
        "iframe",
        "Welcome, Desktop, First visit",
        "allow-same-origin",
        "1280",
        "800",
        "lazy",
      ],
    ],
  );
  for (const frame of frames) {
    const source = attribute(frame, "srcdoc");
    assert.equal(typeof source, "string");
    assert.doesNotMatch(source!, /<script|data-mokly-frame-probe/iu);
  }
  assert.ok(
    attribute(frames[0]!, "srcdoc")?.includes(
      '<h1 data-sample-line="12">Welcome, Ada</h1>',
    ),
  );
});

test("an unbuildable sample reports the guide path, sample path and Mokly error", async () => {
  const processor = await createSatteriMarkdownProcessor({
    hastPlugins: [sampleFence],
    shikiConfig: { transformers: [sampleTransformer] },
  });
  await assert.rejects(
    processor.render(
      "```html sample=specs/broken.screen.html\n---\ntitle: Broken\n---\n<acme-card></acme-card>\n```",
      {
        fileURL: pathToFileURL(path.join(GUIDE_CONTENT, "fixtures/broken.md")),
      },
    ),
    {
      message:
        /fixtures\/broken\.md[\s\S]*specs\/broken\.screen\.html[\s\S]*acme-card/u,
    },
  );
});
