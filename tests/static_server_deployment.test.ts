import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { serveStaticFiles } from "./helpers/static_server.js";

test(
  "static deployment switches keep each request on its selected copy",
  { timeout: 30_000 },
  async (context) => {
    const selected = latch();
    const release = latch();
    const resources: {
      root?: string;
      host?: Awaited<ReturnType<typeof serveStaticFiles>>;
      request?: Promise<Response>;
    } = {};
    context.after(async () => {
      release.resolve();
      await resources.request?.catch(() => undefined);
      await resources.host?.close();
      if (resources.root)
        await fs.rm(resources.root, { recursive: true, force: true });
    });
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-static-deployment-"),
    );
    resources.root = root;
    const original = path.join(root, "original");
    const replacement = path.join(root, "replacement");
    await fs.mkdir(original);
    await fs.mkdir(replacement);
    await fs.writeFile(
      path.join(original, "inspector.js"),
      "original inspector",
    );
    await fs.writeFile(
      path.join(replacement, "inspector.js"),
      "replacement inspector",
    );
    let published = original;
    const host = await serveStaticFiles(() => published);
    resources.host = host;
    const stat = fs.stat;
    context.mock.method(fs, "stat", async (file: string) => {
      if (file === path.join(original, "inspector.js")) {
        selected.resolve();
        await release.promise;
      }
      return stat(file);
    });
    const originalRequest = fetch(`${host.url}/inspector.js`);
    resources.request = originalRequest;
    let originalSettled = false;
    void originalRequest.then(
      () => {
        originalSettled = true;
      },
      () => {
        originalSettled = true;
      },
    );
    await selected.promise;
    published = replacement;
    const current = await fetch(`${host.url}/inspector.js`);
    assert.equal(current.status, 200);
    assert.equal(await current.text(), "replacement inspector");
    assert.equal(
      originalSettled,
      false,
      "new requests finish while the old request is held",
    );
    release.resolve();
    const previous = await originalRequest;
    assert.equal(previous.status, 200);
    assert.equal(await previous.text(), "original inspector");
  },
);

function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
