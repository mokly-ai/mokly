import assert from "node:assert/strict";
import test from "node:test";

import type { BuildDiagnostic } from "../dist/build/build_warnings.js";
import { adaptLinkControls } from "../dist/build/link_controls.js";
import { MoklyError } from "../dist/errors.js";

const route = "screens/home.html";
const start =
  '<template data-mokly-link-child-start="mock:details"></template>';
const end = '<template data-mokly-link-child-end=""></template>';
const page = (body: string) =>
  `<!doctype html><html><head></head><body>${body}</body></html>`;
const wrap = (body = "<span>Continue</span>") => `${start}${body}${end}`;
const adapt = (body: string) => adaptLinkControls(page(body), route);
const diagnostic = (
  code: BuildDiagnostic["code"],
  message: string,
): BuildDiagnostic => ({ code, route, message });

for (const [name, body] of [
  ["main tabindex", `<main tabindex="-1">${wrap()}</main>`],
  [
    "details body",
    `<details><summary>Summary</summary><div>${wrap()}</div></details>`,
  ],
  ["audio without controls", `<audio>${wrap()}</audio>`],
  ["video without controls", `<video>${wrap()}</video>`],
  ["contenteditable false", `<div contenteditable="false">${wrap()}</div>`],
  ...[
    "gridcell",
    "listbox",
    "menu",
    "menubar",
    "radiogroup",
    "tablist",
    "tree",
    "treegrid",
  ].map((role) => [role, `<div role="${role}">${wrap()}</div>`]),
] as const) {
  test(`silent ancestor produces no diagnostic: ${name}`, () => {
    const result = adapt(body);
    assert.deepEqual(result.diagnostics, []);
    assert.match(result.html, /<a href="mock:details"/);
  });
}

for (const [name, body, element] of [
  ["button", `<button>${wrap()}</button>`, "<button>"],
  ["label", `<label>${wrap()}</label>`, "<label>"],
  ["summary", `<summary>${wrap()}</summary>`, "<summary>"],
  ["object", `<object>${wrap()}</object>`, "<object>"],
  [
    "audio controls",
    `<audio controls>${wrap()}</audio>`,
    '<audio controls="">',
  ],
  [
    "video controls",
    `<video controls>${wrap()}</video>`,
    '<video controls="">',
  ],
  ...[
    "button",
    "link",
    "checkbox",
    "combobox",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "searchbox",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "textbox",
    "treeitem",
  ].map(
    (role) =>
      [
        `role ${role}`,
        `<div role="${role}">${wrap()}</div>`,
        `<div role="${role}">`,
      ] as const,
  ),
] as const) {
  test(`warning ancestor identifies its feature: ${name}`, () => {
    assert.deepEqual(adapt(body).diagnostics, [
      diagnostic(
        "link-control-ancestor",
        `MockLink child control is inside ${element}; one click or key press has two targets`,
      ),
    ]);
  });
}

test("ancestor role descriptions normalize whitespace and escape quotes", () => {
  const result = adapt(
    `<div role=" presentation\n button &quot;named&quot; ">${wrap()}</div>`,
  );
  assert.deepEqual(result.diagnostics, [
    diagnostic(
      "link-control-ancestor",
      'MockLink child control is inside <div role="presentation button &quot;named&quot;">; one click or key press has two targets',
    ),
  ]);
  assert.doesNotMatch(result.diagnostics[0]!.message, /[\r\n]/);
});

test("ancestor role descriptions escape terminal control characters", () => {
  const result = adapt(`<div role="button &#x1b;[2J">${wrap()}</div>`);
  assert.deepEqual(result.diagnostics, [
    diagnostic(
      "link-control-ancestor",
      'MockLink child control is inside <div role="button \\u001b[2J">; one click or key press has two targets',
    ),
  ]);
  assert.ok(!result.diagnostics[0]!.message.includes("\u001b"));
});

test("the closest warning ancestor is reported", () => {
  assert.deepEqual(
    adapt(`<label><button>${wrap()}</button></label>`).diagnostics,
    [
      diagnostic(
        "link-control-ancestor",
        "MockLink child control is inside <button>; one click or key press has two targets",
      ),
    ],
  );
});

for (const [body, element] of [
  [`<a href="mock:home">${wrap()}</a>`, "<a>"],
  [`<div contenteditable>${wrap()}</div>`, '<div contenteditable="">'],
  [
    `<div contenteditable="true">${wrap()}</div>`,
    '<div contenteditable="true">',
  ],
  [
    `<div contenteditable="plaintext-only">${wrap()}</div>`,
    '<div contenteditable="plaintext-only">',
  ],
] as const) {
  test(`error ancestor names ${element}`, () => {
    assert.throws(
      () => adapt(body),
      (error: unknown) =>
        error instanceof MoklyError &&
        error.message ===
          `[mokly/build-invalid] ${route}: MockLink child control is inside ${element}; move the control outside it`,
    );
  });
}

test("an error ancestor outranks a closer warning ancestor", () => {
  assert.throws(
    () => adapt(`<a href="mock:home"><button>${wrap()}</button></a>`),
    /is inside <a>; move the control outside it/,
  );
});

test("the closest error ancestor is selected", () => {
  assert.throws(
    () =>
      adapt(
        `<a href="mock:home"><div contenteditable="true">${wrap()}</div></a>`,
      ),
    /is inside <div contenteditable="true">; move the control outside it/,
  );
});

test("ancestor errors run before the root contract", () => {
  assert.throws(
    () => adapt(`<a href="mock:home">${wrap("<p>Unsupported</p>")}</a>`),
    /is inside <a>; move the control outside it/,
  );
});

test("disabled state does not lower an ancestor's warning tier", () => {
  assert.deepEqual(adapt(`<button disabled>${wrap()}</button>`).diagnostics, [
    diagnostic(
      "link-control-ancestor",
      "MockLink child control is inside <button>; one click or key press has two targets",
    ),
  ]);
});

test("an ancestor warning does not alter adapted bytes", () => {
  const warned = adapt(`<button>${wrap()}</button>`);
  const silent = adapt(`<div>${wrap()}</div>`);
  assert.equal(
    warned.html.replace("<button>", "<div>").replace("</button>", "</div>"),
    silent.html,
  );
  assert.equal(warned.diagnostics.length, 1);
  assert.deepEqual(silent.diagnostics, []);
});
