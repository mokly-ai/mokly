import assert from "node:assert/strict";
import test from "node:test";

import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

import { parseFrontMatter } from "../src/documents/front_matter.js";
import { renderMarkdown } from "../src/documents/markdown.js";

type Node = DefaultTreeAdapterMap["node"];
function nodes(node: Node): Node[] {
  return [
    node,
    ...("childNodes" in node ? node.childNodes.flatMap(nodes) : []),
  ];
}
function text(node: Node): string {
  return nodes(node)
    .map((child) => ("value" in child ? child.value : ""))
    .join("");
}

for (const tag of [
  "code",
  "CODE",
  "pre",
  "PRE",
  "kbd",
  "kBd",
  "script",
  "ScRiPt",
])
  test(`raw-mode text after ${tag} stays literal across Markdown constructs`, () => {
    const attack =
      '<script/x>document.title="pwned"</script/x> and <svg/onload=alert(1)> and <style/x>body{background:red}</style/x>';
    const source = `Press the <${tag} data-key="x"> key to continue.

Later text ${attack}

## Heading ${attack}

- List ${attack}

> Quote ${attack}

| Text |
| --- |
| Cell ${attack} |

[Link ${attack}](https://example.com)

**Strong ${attack}** and *emphasis ${attack}*`;
    const body = parseFragment(renderMarkdown(source).html);
    for (const node of nodes(body)) {
      if (!("tagName" in node)) continue;
      assert.ok(
        !["script", "style", "svg", "kbd"].includes(node.tagName),
        node.tagName,
      );
      assert.ok(!node.attrs.some((attr) => /^on/i.test(attr.name)));
    }
    assert.ok(text(body).includes(`<${tag} data-key="x">`));
    assert.equal(text(body).split(attack).length - 1, 8);
  });

test("an unclosed literal tag cannot swallow ordinary comparison prose", () => {
  const body = parseFragment(
    renderMarkdown("Press the <kbd> key.\n\nCompare a<b and x<y.").html,
  );
  assert.ok(text(body).includes("Press the <kbd> key."));
  assert.ok(text(body).includes("Compare a<b and x<y."));
  assert.ok(
    !nodes(body).some((node) => "tagName" in node && node.tagName === "b"),
  );
});

test("front matter strips one leading BOM before metadata and body parsing", () => {
  const source =
    '---\ntitle: Chosen\ndescription: Details\ntags: ["guide"]\npath: declared\nmovedFrom: old\n---\n# Body';
  assert.deepEqual(parseFrontMatter(`\uFEFF${source}`, "specs/file.md"), {
    metadata: {
      title: "Chosen",
      description: "Details",
      tags: ["guide"],
      path: "declared",
      movedFrom: "old",
    },
    body: "# Body",
  });
  assert.deepEqual(parseFrontMatter("\uFEFF# Body", "specs/file.md"), {
    metadata: {},
    body: "# Body",
  });
  assert.deepEqual(parseFrontMatter("\uFEFF\uFEFF# Body", "specs/file.md"), {
    metadata: {},
    body: "\uFEFF# Body",
  });
});

test("empty headings cannot select an empty title or generate empty anchors", () => {
  const rendered = renderMarkdown("#\n\n##\n\n### Real\n\n#### !!!");
  assert.equal(rendered.title, "Real");
  assert.deepEqual(rendered.headings, ["real"]);
  assert.ok(!rendered.html.includes('id=""'));
  assert.ok(!rendered.html.includes('id="-2"'));
  assert.ok(rendered.html.includes("<h1></h1>"));
});

test("destinations and titles decode character references exactly once", () => {
  const resolved: string[] = [];
  const result = renderMarkdown(
    '[x](https://example.com/?a=1&amp;b=2 "Tom &amp; Jerry")\n\n![x](a&amp;b.png "Fish &amp;amp; chips")',
    (value) => {
      resolved.push(value);
      return value;
    },
  );
  assert.deepEqual(resolved, ["https://example.com/?a=1&b=2", "a&b.png"]);
  assert.deepEqual(
    result.destinations.map((item) => item.value),
    resolved,
  );
  const elements = nodes(parseFragment(result.html)).filter(
    (node) => "tagName" in node,
  );
  assert.equal(
    elements
      .find((node) => node.tagName === "a")!
      .attrs.find((attr) => attr.name === "title")!.value,
    "Tom & Jerry",
  );
  assert.equal(
    elements
      .find((node) => node.tagName === "img")!
      .attrs.find((attr) => attr.name === "title")!.value,
    "Fish &amp; chips",
  );
});

test("bare ampersands and non-CommonMark references stay literal", () => {
  const result = renderMarkdown(
    '[Link](https://example.com/?a=1&not=2 "Tom &copy Jerry")\n\n# &copy and &#12345678;',
  );
  const link = nodes(parseFragment(result.html)).find(
    (node) => "tagName" in node && node.tagName === "a",
  );
  assert.ok(link && "attrs" in link);
  assert.equal(
    link.attrs.find((attr) => attr.name === "href")!.value,
    "https://example.com/?a=1&not=2",
  );
  assert.equal(
    link.attrs.find((attr) => attr.name === "title")!.value,
    "Tom &copy Jerry",
  );
  assert.equal(result.title, "&copy and &#12345678;");
});

for (const source of [
  "<https://example.com/?a=1&amp;b=2>",
  "https://example.com/?a=1&amp;b=2",
])
  test(`autolinks keep URI character references literal: ${source}`, () => {
    const result = renderMarkdown(source);
    const link = nodes(parseFragment(result.html)).find(
      (node) => "tagName" in node && node.tagName === "a",
    );
    assert.ok(link && "attrs" in link);
    const expected = "https://example.com/?a=1&amp;b=2";
    assert.equal(
      link.attrs.find((attr) => attr.name === "href")!.value,
      expected,
    );
    assert.equal(text(link), expected);
    assert.equal(result.destinations[0]?.value, expected);
  });
