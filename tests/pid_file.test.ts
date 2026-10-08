import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { readPidFile } from "./helpers/pid_file.js";

async function pidFile(context: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-pid-file-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  return path.join(root, "child.pid");
}

test("a missing process ID file is not ready yet", async (context) => {
  assert.equal(await readPidFile(await pidFile(context)), undefined);
});

test("a created but unwritten process ID file is not ready yet", async (context) => {
  const file = await pidFile(context);
  for (const text of ["", " ", "\n"]) {
    await fs.writeFile(file, text);
    assert.equal(await readPidFile(file), undefined, JSON.stringify(text));
  }
});

test("a written process ID file gives the process ID", async (context) => {
  const file = await pidFile(context);
  for (const [text, pid] of [
    ["4242", 4242],
    ["4242\n", 4242],
    [" 7 ", 7],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ] as const) {
    await fs.writeFile(file, text);
    assert.equal(await readPidFile(file), pid, JSON.stringify(text));
  }
});

test("other process ID file text rejects with the path and the text", async (context) => {
  const file = await pidFile(context);
  for (const text of [
    "0",
    "-12",
    "+12",
    "012",
    "12abc",
    "1e3",
    "0x1F",
    "12.5",
    "abc",
    String(Number.MAX_SAFE_INTEGER + 1),
  ]) {
    await fs.writeFile(file, text);
    await assert.rejects(
      readPidFile(file),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes(file), error.message);
        assert.ok(error.message.includes(JSON.stringify(text)), error.message);
        return true;
      },
      JSON.stringify(text),
    );
  }
});

test("read errors other than a missing file reject unchanged", async (context) => {
  const file = await pidFile(context);
  await fs.mkdir(file);
  await assert.rejects(readPidFile(file), { code: "EISDIR" });
});
