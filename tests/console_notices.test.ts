import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";

import type { Page } from "@playwright/test";
import ts from "typescript";

import {
  captureBrowserErrors,
  viewerSandboxNotice,
} from "./browser/console_notices.js";
import {
  testSources,
  testSourceLocation,
  visitTestSource,
} from "./helpers/test_sources.js";

const REASON =
  "because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";
const blocked = (url: string) =>
  `Blocked script execution in '${url}' ${REASON}`;

test("a blocked script in a viewer-owned sandboxed frame is an expected notice", () => {
  for (const url of [
    "about:srcdoc",
    "http://127.0.0.1:4517/static/shop/cart/index.mobile.html",
    `https://catalogue.example/__mokly/components/renders/${"a".repeat(48)}.${"b".repeat(64)}/library/button/index.desktop.html`,
  ])
    assert.equal(viewerSandboxNotice(blocked(url), ""), true, url);
  assert.equal(
    viewerSandboxNotice(
      blocked("about:blank"),
      "http://127.0.0.1:4517/static/shop/cart/index.mobile.html",
    ),
    true,
    "Chrome locates the report in a stage frame",
  );
});

test("shared capture records console and page errors without a favicon exception", () => {
  const page = new EventEmitter();
  const errors = captureBrowserErrors(page as unknown as Page);
  assert.equal(page.listenerCount("console"), 1);
  assert.equal(page.listenerCount("pageerror"), 1);
  const message = (type: string, text: string, url = "") => ({
    type: () => type,
    text: () => text,
    location: () => ({ url }),
  });
  page.emit("console", message("error", blocked("about:srcdoc")));
  page.emit("console", message("warning", "ordinary warning"));
  page.emit(
    "console",
    message("error", "missing icon", "http://localhost/favicon.ico"),
  );
  page.emit("console", message("error", "Uncaught TypeError"));
  page.emit("pageerror", new Error("frame script failed"));
  assert.deepEqual(errors, [
    "missing icon",
    "Uncaught TypeError",
    "frame script failed",
  ]);
});

test("only the shared capture and the two message-specific checks subscribe to console", () => {
  const allowed = new Set(
    [
      "tests/browser/console_notices.ts",
      "tests/browser/removed_previews_viewer.spec.ts",
      "tests/browser/viewer_hydration.spec.ts",
    ].map((filename) => path.resolve(filename)),
  );
  const violations: string[] = [];
  for (const source of testSources()) {
    visitTestSource(source, (node) => {
      if (
        !ts.isCallExpression(node) ||
        !ts.isPropertyAccessExpression(node.expression)
      )
        return;
      if (
        ![
          "on",
          "once",
          "addListener",
          "prependListener",
          "prependOnceListener",
        ].includes(node.expression.name.text)
      )
        return;
      const event = node.arguments[0];
      if (
        event &&
        ts.isStringLiteralLike(event) &&
        event.text === "console" &&
        !allowed.has(source.fileName)
      )
        violations.push(testSourceLocation(node));
    });
  }
  assert.deepEqual(violations, []);
});

test("every other console error stays an error", () => {
  for (const [text, location] of [
    [blocked("http://127.0.0.1:4517/view/shop/cart/"), ""],
    [blocked("http://127.0.0.1:4517/statics/cart.html"), ""],
    [
      blocked("http://127.0.0.1:4517/site/static/shop/cart/index.mobile.html"),
      "",
    ],
    [blocked("http://127.0.0.1:4517/view/design/static/index.html"), ""],
    [blocked("about:blank"), "http://127.0.0.1:4517/site/static/cart.html"],
    [blocked("about:srcdoc") + " trailing text", "about:srcdoc"],
    [blocked("about:srcdoc") + "\n", "about:srcdoc"],
    ["Prefix: " + blocked("about:srcdoc"), "about:srcdoc"],
    [blocked("about:blank"), ""],
    [`Blocked script execution in 'about:srcdoc'`, "about:srcdoc"],
    ["Uncaught TypeError: x is not a function", "about:srcdoc"],
    [
      "Refused to execute inline script because it violates the following Content Security Policy directive",
      "http://127.0.0.1:4517/static/shop/cart/index.mobile.html",
    ],
  ] as const)
    assert.equal(viewerSandboxNotice(text, location), false, text);
});
