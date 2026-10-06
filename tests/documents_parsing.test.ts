import assert from "node:assert/strict";
import test from "node:test";

import { parseFrontMatter } from "../packages/mokly/src/documents/front_matter.js";
import { renderMarkdown } from "../packages/mokly/src/documents/markdown.js";

const location = "specs/example/README.md";

test("front matter accepts all fields, JSON escapes, bare text and CRLF", () => {
  assert.deepEqual(
    parseFrontMatter(
      '---\r\ntitle: "Welcome \\"home\\""\r\ndescription:  Plain text: ready  \r\ntags: ["one", "two-words"]\r\npath: example\r\nmovedFrom: old/example\r\n---\r\n# Body'.replaceAll(
        '\\"',
        '\\"',
      ),
      location,
    ),
    {
      metadata: {
        title: 'Welcome "home"',
        description: "Plain text: ready",
        tags: ["one", "two-words"],
        path: "example",
        movedFrom: "old/example",
      },
      body: "# Body",
    },
  );
  assert.deepEqual(parseFrontMatter("---\n---\nBody", location), {
    metadata: {},
    body: "Body",
  });
  assert.deepEqual(
    parseFrontMatter('---\ntags: []\ndescription: ""\n---\n', location),
    { metadata: { tags: [], description: "" }, body: "" },
  );
  for (const body of [
    "# Body",
    "\n---\ntitle: Not metadata\n---",
    "--- ",
    "text\n---",
  ])
    assert.deepEqual(parseFrontMatter(body, location), { metadata: {}, body });
  assert.equal(
    parseFrontMatter("---\ntitle: true\n---", location).metadata.title,
    "true",
  );
});

for (const [input, reason] of [
  ["---\nnope: text\n---", "unknown field nope"],
  ["---\npath: first\npath: second\n---", "repeated field path"],
  ["---\nwrong\n---", 'line 2 is not "key: value"'],
  ["---\n\n---", 'line 2 is not "key: value"'],
  ["---\n title: indented\n---", 'line 2 is not "key: value"'],
  ['---\ntitle: "unclosed\n---', "title must be a string"],
  ["---\ntitle: []\n---", "title must be a string"],
  ["---\ndescription: {}\n---", "description must be a string"],
  ['---\npath: ["one"]\n---', "path must be a string"],
  ["---\nmovedFrom: {}\n---", "movedFrom must be a string"],
  ["---\ntags: bare\n---", "tags must be an array of strings"],
  ['---\ntags: "tag"\n---', "tags must be an array of strings"],
  ['---\ntags: ["tag", 4]\n---', "tags must be an array of strings"],
  ["---\ntags: [\n---", "tags must be an array of strings"],
  ["---\ntitle: value", "block is not closed"],
] as const)
  test(`front matter diagnostic: ${reason} (${input})`, () => {
    assert.throws(() => parseFrontMatter(input, location), {
      code: "build-invalid",
      message: `[mokly/build-invalid] ${location}: front matter ${reason}`,
    });
  });

test("Markdown renders CommonMark and each supported GFM construct", () => {
  const result = renderMarkdown(
    '# A *heading*\n\nA **strong** word and ~~deleted~~ `code`.\n\n> A quote\n\n1. First\n2. Second\n\n- [x] Done\n- [ ] Pending\n\n| Name | Value |\n| --- | --- |\n| One | Two |\n\nhttps://example.com and person@example.com\n\n```ts\nconst name = "value";\n```\n\n---',
  );
  for (const part of [
    '<h1 id="a-heading">',
    "<em>heading</em>",
    "<strong>strong</strong>",
    "<del>deleted</del>",
    "<code>code</code>",
    "<blockquote>",
    "<ol>",
    "<table>",
    'type="checkbox"',
    "checked",
    'href="https://example.com"',
    'href="mailto:person@example.com"',
    'class="language-ts"',
    "<hr>",
  ])
    assert.ok(result.html.includes(part), part);
  assert.equal(result.title, "A heading");
});

test("raw HTML is literal text, including script, inline tags and comments", () => {
  const { html } = renderMarkdown(
    "<script>alert(1)</script>\n\nText <b>bold</b> <!-- comment -->\n\n<img src=x onerror=alert(1)>",
  );
  assert.ok(!/<(?:script|img|b)\b|<!--/.test(html));
  for (const part of [
    "&lt;script&gt;",
    "&lt;b&gt;",
    "&lt;!-- comment --&gt;",
    "&lt;img",
  ])
    assert.ok(html.includes(part));
});

test("heading anchors are deterministic, decoded, unique and independent per render", () => {
  const source =
    "## Hello, **World**!\n\n# Hello World\n\n### Hello World-2\n\n## Hello World\n\n# Café &amp; tea\n\n# ![A logo](logo.svg)";
  const expected = [
    "hello-world",
    "hello-world-2",
    "hello-world-2-2",
    "hello-world-3",
    "café--tea",
    "a-logo",
  ];
  assert.deepEqual(renderMarkdown(source).headings, expected);
  assert.deepEqual(renderMarkdown(source).headings, expected);
});

test("heading text decodes entities once and preserves code span literals", () => {
  assert.equal(renderMarkdown("# **&amp;amp;**").title, "&amp;");
  assert.equal(renderMarkdown("# `&amp;`").title, "&amp;");
  assert.deepEqual(renderMarkdown("# Cafe\u0301").headings, ["cafe\u0301"]);
});

test("destination rewriting visits links, images, tables and reference links", () => {
  const result = renderMarkdown(
    "[Link][a]\n\n![Image](image.png)\n\n| Links |\n| --- |\n| [Source](file.ts) |\n\n[a]: other.md",
    (value) => (value === "file.ts" ? null : `safe/${value}`),
  );
  assert.ok(result.html.includes('href="safe/other.md"'));
  assert.ok(result.html.includes('src="safe/image.png"'));
  assert.ok(result.html.includes("<td>Source</td>"));
  assert.deepEqual(
    result.destinations.map((item) => item.value),
    ["other.md", "image.png", "file.ts"],
  );
});
