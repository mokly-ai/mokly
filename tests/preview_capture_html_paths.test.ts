import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { capturePage } from "../scripts/preview/capture.mjs";

test("preview capture normalizes only canonical HTML paths", async (context) => {
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-capture-"));
  context.after(() => fs.rm(stage, { recursive: true, force: true }));
  const rejected = [
    "/view/constructor/home.html",
    "/static/../secret.html",
    "/static/a%2fb.html",
    "/static/%2e%2e/x.html",
  ];
  const source = [
    '<script src="/__mokly/client/react-host.js" type="module"></script>',
    '<a href="/view/home/?fragment=hero">Home</a>',
    '<img src="/static/assets/logo.html#mark">',
    ...rejected.map((value) => `<a href="${value}">Rejected</a>`),
  ].join("");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(source);
  context.after(() => {
    globalThis.fetch = previousFetch;
  });

  await capturePage("http://127.0.0.1:1", "/", stage, "index.html");
  const captured = await fs.readFile(path.join(stage, "index.html"), "utf8");
  assert.ok(captured.includes('href="/view/home/?fragment=hero"'));
  assert.ok(captured.includes('src="/static/assets/logo#mark"'));
  assert.ok(
    captured.includes(
      '<script src="/__mokly/client/react-shell.js" type="module"></script>',
    ),
  );
  for (const value of rejected)
    assert.ok(captured.includes(`href="${value}"`), value);
});
