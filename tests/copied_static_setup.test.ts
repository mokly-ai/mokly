import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { copiedHost } from "./browser/copied_host.js";
import { startCopiedStaticHost } from "./browser/copied_static_setup.js";

for (const fail of [false, true]) {
  test(`copied host drains its source workspace on ${fail ? "preparation failure" : "success"}`, async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-copy-test-"));
    const previous = process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"];
    process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] = parent;
    try {
      const expected = new Error("prepare failed");
      const pending = copiedHost("copy-", async (source, output) => {
        await fs.mkdir(output, { recursive: true });
        await fs.writeFile(path.join(source, "private.txt"), "source only");
        await fs.writeFile(path.join(output, "index.html"), "copied output");
        if (fail) throw expected;
      });
      if (fail) await assert.rejects(pending, (error) => error === expected);
      else {
        const host = await pending;
        assert.deepEqual(await fs.readdir(path.dirname(host.directory)), [
          "isolated",
        ]);
        assert.equal(await (await fetch(host.url)).text(), "copied output");
        assert.equal((await fetch(host.url + "/private.txt")).status, 404);
        await Promise.all([host.close(), host.close()]);
      }
      assert.deepEqual(await fs.readdir(parent), []);
    } finally {
      if (previous === undefined)
        delete process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"];
      else process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] = previous;
      await fs.rm(parent, { recursive: true, force: true });
    }
  });
}

test("supplying a Changes build rejects setup before copying and leaves the input intact", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-copy-input-"));
  const names = [
    "MOKLY_VERIFICATION_RESOURCE_ROOT",
    "MOKLY_PLAYWRIGHT_STATIC_DIR",
  ] as const;
  const before = names.map((name) => process.env[name]);
  const supplied = path.join(parent, "supplied");
  process.env[names[0]] = parent;
  process.env[names[1]] = supplied;
  try {
    await fs.mkdir(path.join(supplied, "mokly-viewer"), { recursive: true });
    const file = path.join(supplied, "mokly-viewer/index.json");
    const content = '{"changesStatus":"ready"}';
    await fs.writeFile(file, content);
    await assert.rejects(startCopiedStaticHost(), {
      message: `Static browser catalogue ${supplied} must have changesStatus "disabled"; build it with --no-changes`,
    });
    assert.equal(await fs.readFile(file, "utf8"), content);
    assert.deepEqual(await fs.readdir(parent), ["supplied"]);
  } finally {
    names.forEach((name, index) => {
      if (before[index] === undefined) delete process.env[name];
      else process.env[name] = before[index];
    });
    await fs.rm(parent, { recursive: true, force: true });
  }
});
