import assert from "node:assert/strict";
import test from "node:test";

import { adaptLinkControls } from "../dist/build/link_controls.js";

const start =
  '<template data-mokly-link-child-start="mock:details"></template>';
const end = '<template data-mokly-link-child-end=""></template>';
const page = (body: string) =>
  `<!doctype html><html><head><title>Control</title></head><body>${body}</body></html>`;
const wrap = (body: string) => `${start}${body}${end}`;
const adapt = (body: string) =>
  adaptLinkControls(page(body), "home/index.html");

test("patches retain unrelated bytes and marked control content exactly", () => {
  const outside =
    "<!-- spelling -->\n<p class='untouched'>A &amp; B &#67;</p>\r\n";
  const content = "<span title='A &amp; B'>Keep &#x20; bytes</span>";
  const output = adapt(
    `${outside}${wrap(`<DIV class='row' STYLE='display:flex' data-owner='consumer'>${content}</DIV>`)}${outside}`,
  );
  assert.equal(output.split(outside).length, 3);
  assert.ok(output.includes(content));
  assert.match(
    output,
    /<a class='row' STYLE='display:flex' data-owner='consumer'/,
  );
  assert.doesNotMatch(output, /<template|data-mokly-link-child/);
});

test("several sibling controls produce one stylesheet and keep intervening content", () => {
  const output = adapt(
    `${wrap("<button>First</button>")}<hr>${wrap("<span>Second</span>")}`,
  );
  assert.equal((output.match(/<style /g) ?? []).length, 1);
  assert.equal((output.match(/href="mock:details"/g) ?? []).length, 2);
  assert.match(output, /First<\/a><hr><a /);
});

for (const ancestor of [
  "<fieldset disabled>",
  "<div inert>",
  '<div aria-disabled="true">',
  '<div aria-busy="true">',
]) {
  test(`inactive ancestor cannot enable a child link: ${ancestor}`, () => {
    const tag = ancestor.startsWith("<fieldset") ? "fieldset" : "div";
    const output = adapt(
      `${ancestor}${wrap('<button type="submit" form="payments">Continue</button>')}</${tag}>`,
    );
    assert.match(output, /<button/);
    assert.match(output, /data-nav-href="mock:details" type="button"/);
    assert.doesNotMatch(output, /<a |<style |form="payments"/);
  });
}

for (const body of [
  start,
  end,
  `${end}${start}`,
  `${start}<button>Open</button>`,
  start.replace("start", "unknown") + "<button>Bad</button>" + end,
  start.replace('="mock:details"', '="mock:details" data-other="bad"') +
    "<button>Bad</button>" +
    end,
  start.replace(
    '="mock:details"',
    '="mock:details" data-mokly-link-child-start="mock:home"',
  ) +
    "<button>Bad</button>" +
    end,
  start.replace("></template>", ">Unexpected</template>") +
    "<button>Bad</button>" +
    end,
  start.replace("mock:details", "https://example.test") +
    "<button>Bad</button>" +
    end,
  wrap("<button disabled DISABLED>Duplicate</button>"),
  wrap('<button role="button" role="checkbox">Duplicate</button>'),
  wrap("<span>One</span> extra text"),
  wrap("<span>One</span><span>Two</span>"),
  wrap('<button onclick="alert(1)">Script</button>'),
  wrap('<div><span onclick="alert(1)">Scripted child</span></div>'),
  wrap('<div contenteditable="true">Editable</div>'),
  wrap("<button><input disabled></button>"),
  wrap('<span><svg><a href="mock:details">SVG link</a></svg></span>'),
  wrap("<div><video controls></video></div>"),
  wrap('<div><span role="switch">Switch</span></div>'),
  wrap("<div><iframe></iframe></div>"),
  wrap("<p>Unsupported root</p>"),
  `<button>${wrap("<span>Inside button</span>")}</button>`,
  `<div contenteditable="true">${wrap("<span>Editable ancestor</span>")}</div>`,
  wrap(`<div>${wrap("<span>Nested</span>")}</div>`),
  `${start}<div><button>Repaired</div>${end}`,
  `<template>${wrap("<button>Inert</button>")}</template>`,
]) {
  test(`malformed or ambiguous adaptation is rejected: ${body}`, () => {
    assert.throws(() => adapt(body), /MockLink child control/);
  });
}

test("ordinary input is untouched, including metadata-only navigation", () => {
  const html = page(
    '<span data-nav-href="mock:details"><button>Metadata</button></span>',
  );
  assert.equal(adaptLinkControls(html, "home.html"), html);
});

test("control CSS belongs to the document head even with similarly named SVG elements", () => {
  const output = adapt(
    `${wrap("<button>Open</button>")}<svg><head></head></svg>`,
  );
  assert.match(output, /<head><title>Control<\/title><style /);
  assert.match(output, /<svg><head><\/head><\/svg>/);
});
