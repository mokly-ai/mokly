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
const wrap = (body: string) => `${start}${body}${end}`;
const adapt = (body: string) => adaptLinkControls(page(body), route);
const diagnostic = (message: string): BuildDiagnostic => ({
  code: "link-control-descendant",
  route,
  message,
});
const exactFailure = (body: string, message: string): void => {
  assert.throws(
    () => adapt(wrap(body)),
    (error: unknown) =>
      error instanceof MoklyError &&
      error.message === `[mokly/build-invalid] ${route}: ${message}`,
  );
};

for (const tabindex of ["0", "-1"]) {
  test(`descendant tabindex ${tabindex} warns`, () => {
    assert.deepEqual(
      adapt(wrap(`<div><span tabindex="${tabindex}">Focus</span></div>`))
        .diagnostics,
      [
        diagnostic(
          `MockLink child control contains <span tabindex="${tabindex}">; the link has an extra focus stop`,
        ),
      ],
    );
  });
}

for (const role of [
  "gridcell",
  "listbox",
  "menu",
  "menubar",
  "radiogroup",
  "tablist",
  "tree",
  "treegrid",
]) {
  test(`descendant group role ${role} warns`, () => {
    assert.deepEqual(
      adapt(wrap(`<div><span role="${role}">Group</span></div>`)).diagnostics,
      [
        diagnostic(
          `MockLink child control contains <span role="${role}">; the role does not belong inside a link`,
        ),
      ],
    );
  });
}

test("non-activatable descendant media and editable false stay silent", () => {
  assert.deepEqual(
    adapt(
      wrap(
        '<div><audio></audio><video></video><span contenteditable="false">Text</span></div>',
      ),
    ).diagnostics,
    [],
  );
});

for (const tag of [
  "a",
  "area",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "details",
  "label",
  "iframe",
  "object",
  "embed",
]) {
  test(`descendant ${tag} fails and names the element`, () => {
    exactFailure(
      `<div><${tag}>Nested</${tag}></div>`,
      `MockLink child control contains <${tag}>; remove the nested interactive element`,
    );
  });
}

test("an SVG link keeps tag-based descendant error semantics", () => {
  exactFailure(
    '<span><svg><a href="mock:details">SVG link</a></svg></span>',
    "MockLink child control contains <a>; remove the nested interactive element",
  );
});

test("disabled state does not lower a descendant's error tier", () => {
  exactFailure(
    "<div><button disabled>Disabled</button></div>",
    "MockLink child control contains <button>; remove the nested interactive element",
  );
});

for (const value of ["", "true", "plaintext-only"]) {
  test(`editable descendant value ${JSON.stringify(value)} fails`, () => {
    exactFailure(
      `<div><span contenteditable="${value}">Edit</span></div>`,
      `MockLink child control contains <span contenteditable="${value}">; remove the nested interactive element`,
    );
  });
}

for (const tag of ["audio", "video"]) {
  test(`${tag} with controls fails as a descendant`, () => {
    exactFailure(
      `<div><${tag} controls></${tag}></div>`,
      `MockLink child control contains <${tag} controls="">; remove the nested interactive element`,
    );
  });
}

for (const role of [
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
]) {
  test(`descendant control role ${role} fails`, () => {
    exactFailure(
      `<div><span role="${role}">Control</span></div>`,
      `MockLink child control contains <span role="${role}">; remove the nested interactive element`,
    );
  });
}

test("inline descendant handlers name only the first handler attribute", () => {
  exactFailure(
    '<div><span onmouseover="first-secret" onclick="second-secret">Script</span></div>',
    "MockLink child control contains <span onmouseover>; remove the inline event handler",
  );
  assert.throws(
    () => adapt(wrap('<div><span onclick="secret-value">Script</span></div>')),
    (error: unknown) =>
      error instanceof Error && !error.message.includes("secret-value"),
  );
});

test("descendant tier and feature precedence select the strongest first feature", () => {
  exactFailure(
    '<div><button tabindex="0">Button</button></div>',
    "MockLink child control contains <button>; remove the nested interactive element",
  );
  exactFailure(
    '<div><span role="button" onclick="go()">Role</span></div>',
    'MockLink child control contains <span role="button">; remove the nested interactive element',
  );
  assert.deepEqual(
    adapt(wrap('<div><span role="menu" tabindex="0">Group</span></div>'))
      .diagnostics,
    [
      diagnostic(
        'MockLink child control contains <span role="menu">; the role does not belong inside a link',
      ),
    ],
  );
});

test("a multiline descendant role produces one normalized warning line", () => {
  const result = adapt(
    wrap(
      '<div><span role=" presentation\n menu &quot;named&quot; ">Group</span></div>',
    ),
  );
  assert.deepEqual(result.diagnostics, [
    diagnostic(
      'MockLink child control contains <span role="presentation menu &quot;named&quot;">; the role does not belong inside a link',
    ),
  ]);
  assert.doesNotMatch(result.diagnostics[0]!.message, /[\r\n]/);
});

test("descendants scan past warnings for the first error", () => {
  exactFailure(
    '<div><span tabindex="0">Warning</span><input><button>Later</button></div>',
    "MockLink child control contains <input>; remove the nested interactive element",
  );
});

test("the root contract runs before descendant classification", () => {
  assert.throws(
    () => adapt(wrap("<p><button>Nested</button></p>")),
    /requires an HTML a, button, div, or span root/,
  );
});

test("one control can report one ancestor and one descendant warning", () => {
  assert.deepEqual(
    adapt(
      `<button>${wrap('<div><span tabindex="-1">Focus</span></div>')}</button>`,
    ).diagnostics,
    [
      {
        code: "link-control-ancestor",
        route,
        message:
          "MockLink child control is inside <button>; one click or key press has two targets",
      },
      diagnostic(
        'MockLink child control contains <span tabindex="-1">; the link has an extra focus stop',
      ),
    ],
  );
});
