import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exchange } from "./helpers/static_exchange.js";
import { publicationFixture, publish } from "./helpers/static_publication.js";

async function reservations(privateRoot: string) {
  assert.equal(
    await fs.readFile(
      path.join(privateRoot, ".mokly-export-reservations/.owner"),
      "utf8",
    ),
    "mokly-export-reservations-v1\n",
  );
  assert.ok(
    (
      await fs.stat(path.join(privateRoot, ".mokly-export-reservations/locks"))
    ).isDirectory(),
  );
}

for (const outcome of ["success", "already-published"] as const) {
  test(
    `publish removes its whole private directory after ${outcome}`,
    { timeout: 120_000 },
    async (context) => {
      const repository = await publicationFixture();
      context.after(() => fs.rm(repository, { recursive: true, force: true }));
      const receiver = await exchange();
      context.after(() => receiver.close());
      const attempts = outcome === "success" ? 1 : 2;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const running = publish(repository, receiver.endpoint, "plain", {
          signal: context.signal,
        });
        receiver.beforeComplete(async () => {
          const privateRoot = path.dirname(await running.buildDirectory);
          await reservations(privateRoot);
          await fs.writeFile(
            path.join(privateRoot, "private-note"),
            "owned by this publication",
          );
        });
        const privateRoot = path.dirname(await running.buildDirectory);
        context.after(() =>
          fs.rm(privateRoot, { recursive: true, force: true }),
        );
        const result = await running.result;
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stderr, "");
        if (attempt === 1)
          assert.match(result.stdout, /already published for this commit/u);
        if (attempt === attempts - 1)
          await assert.rejects(fs.lstat(privateRoot), { code: "ENOENT" });
      }
    },
  );
}

test(
  "publish failure retains the complete private directory and reservations",
  { timeout: 120_000 },
  async (context) => {
    const repository = await publicationFixture();
    context.after(() => fs.rm(repository, { recursive: true, force: true }));
    const receiver = await exchange({ planStatus: 403 });
    context.after(() => receiver.close());
    const running = publish(repository, receiver.endpoint, "plain", {
      signal: context.signal,
    });
    const output = await running.buildDirectory;
    const privateRoot = path.dirname(output);
    context.after(() => fs.rm(privateRoot, { recursive: true, force: true }));
    const result = await running.result;
    assert.equal(result.code, 1);
    assert.equal(receiver.completed, 0);
    assert.ok(
      (await fs.stat(path.join(output, ".mokly-export-artifact"))).isFile(),
    );
    await reservations(privateRoot);
  },
);

test(
  "publish removes a private sibling symlink and preserves its target",
  { timeout: 120_000 },
  async (context) => {
    const repository = await publicationFixture();
    context.after(() => fs.rm(repository, { recursive: true, force: true }));
    const receiver = await exchange();
    context.after(() => receiver.close());
    const running = publish(repository, receiver.endpoint, "plain", {
      signal: context.signal,
    });
    receiver.beforeComplete(async () => {
      const privateRoot = path.dirname(await running.buildDirectory);
      await reservations(privateRoot);
      await fs.symlink(
        repository,
        path.join(privateRoot, "external"),
        "junction",
      );
    });
    const privateRoot = path.dirname(await running.buildDirectory);
    context.after(() => fs.rm(privateRoot, { recursive: true, force: true }));
    const result = await running.result;
    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      await fs.readFile(path.join(repository, "signal.txt"), "utf8"),
      "original",
    );
    await assert.rejects(fs.lstat(privateRoot), { code: "ENOENT" });
  },
);

test(
  "publish cleanup failure warns with its stored private root and keeps success",
  { timeout: 120_000 },
  async (context) => {
    const repository = await publicationFixture();
    context.after(() => fs.rm(repository, { recursive: true, force: true }));
    const receiver = await exchange();
    context.after(() => receiver.close());
    const running = publish(repository, receiver.endpoint, "plain", {
      signal: context.signal,
    });
    receiver.beforeComplete(async () => {
      const privateRoot = path.dirname(await running.buildDirectory);
      const retained = `${privateRoot}-retained`;
      await fs.rename(privateRoot, retained);
      await fs.writeFile(privateRoot, "replacement blocks directory removal");
    });
    const privateRoot = path.dirname(await running.buildDirectory);
    const retained = `${privateRoot}-retained`;
    context.after(() => fs.rm(privateRoot, { recursive: true, force: true }));
    context.after(() => fs.rm(retained, { recursive: true, force: true }));
    const result = await running.result;
    assert.equal(result.code, 0, result.stderr);
    assert.equal(receiver.completed, 1);
    assert.equal(
      result.stderr,
      `[mokly/warning] Publication completed. The local build remains at ${privateRoot}. Remove it when you no longer need it.\n`,
    );
    assert.equal(
      await fs.readFile(privateRoot, "utf8"),
      "replacement blocks directory removal",
    );
    await reservations(retained);
  },
);
