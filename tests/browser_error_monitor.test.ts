import assert from "node:assert/strict";
import test from "node:test";

import { documentFavicon } from "./browser/document_error_allowance.js";
import {
  allowedBrowserFailure,
  type ErrorAllowance,
} from "./browser/error_monitor.js";
import { nestedScriptNotice } from "./browser/navigation_error_allowances.js";

test("browser error allowances match kind, message and optional exact resource", () => {
  const failure = {
    kind: "console" as const,
    message: "Expected refusal",
    url: "https://host.test/failed.json",
  };
  const rules = [
    {
      kind: "console" as const,
      message: /^Expected refusal$/g,
      url: /^https:\/\/host.test\/failed\.json$/g,
    },
  ];
  assert.equal(allowedBrowserFailure(failure, []), false);
  assert.equal(allowedBrowserFailure(failure, rules), true);
  assert.equal(allowedBrowserFailure(failure, rules), true);
  assert.equal(
    allowedBrowserFailure({ ...failure, kind: "pageerror" }, rules),
    false,
  );
  assert.equal(
    allowedBrowserFailure({ ...failure, message: "Unexpected refusal" }, rules),
    false,
  );
  assert.equal(
    allowedBrowserFailure(
      { ...failure, url: "https://host.test/other.json" },
      rules,
    ),
    false,
  );
});

test("the native document favicon allowance is confined to its exact origin and path", () => {
  const rules: ErrorAllowance[] = [];
  documentFavicon((rule) => rules.push(rule), "http://127.0.0.1:1234");
  const failure = {
    kind: "console" as const,
    message:
      "Failed to load resource: the server responded with a status of 404 (Not Found)",
    url: "http://127.0.0.1:1234/favicon.ico",
  };
  assert.equal(allowedBrowserFailure(failure, rules), true);
  for (const url of [
    "http://127X0X0X1:1234/favicon.ico",
    "http://127.0.0.1:1234/faviconXico",
    "http://127.0.0.1:1235/favicon.ico",
    "http://127.0.0.1:1234/style.css",
  ])
    assert.equal(allowedBrowserFailure({ ...failure, url }, rules), false);
});

test("sandbox fixture notices accept absent locations without accepting a different message", () => {
  const nested =
    "Blocked script execution in 'https://cross-origin.example.test/nested.html' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";
  for (const url of ["", "https://cross-origin.example.test/nested.html"])
    assert.equal(
      allowedBrowserFailure({ kind: "console", message: nested, url }, [
        nestedScriptNotice,
      ]),
      true,
    );
  assert.equal(
    allowedBrowserFailure(
      {
        kind: "console",
        message: nested.replace("nested.html", "other.html"),
        url: "",
      },
      [nestedScriptNotice],
    ),
    false,
  );
});
