import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { browserHost, listeningAddress, serveHost } from "./browser/hosts.js";

const required = [
  "index.html",
  "mokly-viewer/index.json",
  ".mokly-export-artifact",
];

test("the static host serves exact files, directory indexes and MIME types without fallbacks", async (context) => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-browser-host-"),
  );
  const root = path.join(parent, "site");
  await fs.mkdir(root);
  await fs.writeFile(path.join(parent, "outside.txt"), "outside secret");
  await fs.mkdir(path.join(root, "mokly-viewer"));
  await fs.mkdir(path.join(root, "nested"));
  for (const name of [
    ...required,
    "nested/index.html",
    "404.html",
    "styles.css",
    "client.mjs",
    "icon.svg",
    "font.woff",
    "photo.webp",
  ])
    await fs.writeFile(path.join(root, name), name);
  const host = await browserHost({ kind: "static", directory: root });
  context.after(async () => {
    await host.close();
    await fs.rm(parent, { recursive: true, force: true });
  });
  assert.equal(await (await fetch(host.url)).text(), "index.html");
  assert.equal(
    await (await fetch(`${host.url}/nested/?ignored=true`)).text(),
    "nested/index.html",
  );
  for (const url of ["missing", "styles", "%2e%2e%2foutside.txt"]) {
    const response = await fetch(`${host.url}/${url}`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not found");
  }
  for (const [name, type] of [
    ["mokly-viewer/index.json", "application/json; charset=utf-8"],
    ["client.mjs", "text/javascript; charset=utf-8"],
    ["icon.svg", "image/svg+xml; charset=utf-8"],
    ["font.woff", "font/woff"],
    ["photo.webp", "image/webp"],
  ]) {
    const response = await fetch(`${host.url}/${name}`);
    assert.equal(response.headers.get("content-type"), type);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
  await Promise.all([host.close(), host.close()]);
});
for (const missing of required) {
  test(`static setup names the resolved path and missing ${missing}`, async (context) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-static-missing-"),
    );
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    await fs.mkdir(path.join(root, "mokly-viewer"));
    for (const name of required.filter((name) => name !== missing))
      await fs.writeFile(path.join(root, name), "fixture");
    await assert.rejects(browserHost({ kind: "static", directory: root }), {
      message: `Static browser catalogue ${root} is missing required file ${missing}`,
    });
  });
}

test("Serve host reports startup failure only after its failed child is gone", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-failed-host-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "pid");
  await assert.rejects(
    serveHost(
      [
        "--eval",
        `require('fs').writeFileSync(${JSON.stringify(file)}, String(process.pid));process.stderr.write('fixture startup failure');process.exitCode=7`,
      ],
      root,
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.message, "Example startup and cleanup failed");
      assert.match(
        String(error.errors[0]),
        /Serve stopped before it listened:[\s\S]*fixture startup failure/,
      );
      return true;
    },
  );
  const pid = Number(await fs.readFile(file, "utf8"));
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});
test("listening addresses require the complete port and line", () => {
  const line = "Mokly listening at http://127.0.0.1:54321\n";
  for (let length = 0; length < line.length; length++)
    assert.equal(listeningAddress(line.slice(0, length)), undefined);
  assert.equal(listeningAddress(`notice\n${line}`), "http://127.0.0.1:54321");
  assert.equal(
    listeningAddress(line.replace("\n", "\r\n")),
    "http://127.0.0.1:54321",
  );
});
