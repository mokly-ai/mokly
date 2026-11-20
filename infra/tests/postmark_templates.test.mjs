import assert from "node:assert/strict";
import { test } from "node:test";

import {
  loadTemplates,
  syncTemplates,
} from "../scripts/sync-postmark-templates.mjs";

const local = {
  Name: "Mokly sign-in",
  Alias: "mokly-sign-in",
  Subject: "Sign in to Mokly",
  HtmlBody: "<p>{{link}}</p>\n",
  TextBody: "{{link}}\n",
  TemplateType: "Standard",
  LayoutTemplate: "",
};
const remote = {
  ...local,
  LayoutTemplate: null,
  TemplateId: 123,
  Active: true,
};
const missing = { ErrorCode: 1101, Message: "Template not found" };
const valid = {
  AllContentIsValid: true,
  ContentIsValid: true,
  ValidationErrors: [],
};
const saved = { TemplateId: 123, Alias: local.Alias, Active: true };

function respond(status, result) {
  return new Response(JSON.stringify(result), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function recordedFetch(replies) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ path: url.pathname, ...options });
    assert.equal(options.headers["X-Postmark-Server-Token"], "test-token");
    const reply = replies.shift();
    assert.ok(reply, "unexpected Postmark request");
    return respond(reply[0], reply[1]);
  };
  return { fetcher, calls, replies };
}

test("committed files load as standard templates with one-line subjects", async () => {
  const templates = await loadTemplates();
  assert.deepEqual(
    templates.map((template) => template.Alias),
    ["mokly-sign-in", "mokly-invitation"],
  );
  for (const template of templates) {
    assert.equal(template.TemplateType, "Standard");
    assert.ok(template.HtmlBody.includes("{{siteOrigin}}/brand/"));
    assert.ok(!template.Subject.includes("\n"));
    assert.ok(template.TextBody.endsWith("\n"));
  }
});

test("missing alias creates and reads back the template", async () => {
  const stub = recordedFetch([
    [422, missing],
    [200, valid],
    [200, saved],
    [200, remote],
  ]);
  const actions = await syncTemplates([local], "test-token", stub.fetcher);
  assert.deepEqual(actions, [{ alias: local.Alias, action: "created" }]);
  assert.deepEqual(
    stub.calls.map(({ method, path }) => [method, path]),
    [
      ["GET", "/templates/mokly-sign-in"],
      ["POST", "/templates/validate"],
      ["POST", "/templates"],
      ["GET", "/templates/mokly-sign-in"],
    ],
  );
  assert.deepEqual(JSON.parse(stub.calls[2].body), local);
  assert.equal(stub.replies.length, 0);
});

test("identical alias makes no write or validation request", async () => {
  const stub = recordedFetch([[200, remote]]);
  const actions = await syncTemplates([local], "test-token", stub.fetcher);
  assert.equal(actions[0].action, "unchanged");
  assert.equal(stub.calls.length, 1);
});

test("changed body updates the alias and verifies the saved bytes", async () => {
  const stub = recordedFetch([
    [200, { ...remote, HtmlBody: "older HTML" }],
    [200, valid],
    [200, saved],
    [200, remote],
  ]);
  const actions = await syncTemplates([local], "test-token", stub.fetcher);
  assert.equal(actions[0].action, "updated");
  assert.equal(stub.calls[2].method, "PUT");
  assert.equal(stub.calls[2].path, "/templates/mokly-sign-in");
  assert.deepEqual(JSON.parse(stub.calls[2].body), {
    Name: local.Name,
    Alias: local.Alias,
    Subject: local.Subject,
    HtmlBody: local.HtmlBody,
    TextBody: local.TextBody,
    LayoutTemplate: "",
  });
});

test("authentication and unexpected lookup errors cannot create templates", async () => {
  for (const [status, result] of [
    [401, { ErrorCode: 10 }],
    [422, { ErrorCode: 1122 }],
  ]) {
    const stub = recordedFetch([[status, result]]);
    await assert.rejects(
      syncTemplates([local], "test-token", stub.fetcher),
      /Postmark GET .*HTTP/,
    );
    assert.equal(stub.calls.length, 1);
  }
});

test("invalid content and provider write errors stop the sync", async () => {
  const invalid = recordedFetch([
    [422, missing],
    [200, { ...valid, AllContentIsValid: false }],
  ]);
  await assert.rejects(
    syncTemplates([local], "test-token", invalid.fetcher),
    /validation failed/,
  );
  assert.equal(invalid.calls.length, 2);

  const rejected = recordedFetch([
    [422, missing],
    [200, valid],
    [422, { ErrorCode: 1122 }],
  ]);
  await assert.rejects(
    syncTemplates([local], "test-token", rejected.fetcher),
    /code 1122/,
  );
  assert.equal(rejected.calls.length, 3);
});

test("an HTTP success with a Postmark application error still fails", async () => {
  const stub = recordedFetch([
    [422, missing],
    [200, valid],
    [200, { ErrorCode: 1122, Message: "Invalid template" }],
  ]);
  await assert.rejects(
    syncTemplates([local], "test-token", stub.fetcher),
    /HTTP 200, code 1122/,
  );
  assert.equal(stub.calls.length, 3);
});

test("a provider rewrite is detected by the read-back comparison", async () => {
  const stub = recordedFetch([
    [200, { ...remote, TextBody: "old" }],
    [200, valid],
    [200, saved],
    [200, { ...remote, TextBody: "normalized" }],
  ]);
  await assert.rejects(
    syncTemplates([local], "test-token", stub.fetcher),
    /saved template differs/,
  );
});

test("an existing layout alias fails without trying to replace it", async () => {
  const stub = recordedFetch([[200, { ...remote, TemplateType: "Layout" }]]);
  await assert.rejects(
    syncTemplates([local], "test-token", stub.fetcher),
    /existing layout/,
  );
  assert.equal(stub.calls.length, 1);
});
