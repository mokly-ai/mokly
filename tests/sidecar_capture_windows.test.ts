import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import type { CaptureHint } from "../packages/mokly/src/generated/sidecar/CaptureHint.js";
import { CaptureDurability } from "../packages/mokly/src/sidecar/capture-durability.js";
import { captureRuntime } from "../packages/mokly/src/sidecar/capture-runtime.js";
import type {
  CaptureRuntime,
  CaptureStat,
} from "../packages/mokly/src/sidecar/capture-runtime.js";
import type { FilePathProbe } from "../packages/mokly/src/sidecar/physical-input-reader.js";
import { PhysicalInputs } from "../packages/mokly/src/sidecar/physical-inputs.js";

const file = "C:\\capture\\source";
const serial = 1383836831n;
const start = 20_000_000_000n;
const hint: CaptureHint = {
  volumes: [{ kind: "windows", dev: "1383836831", roots: ["C:\\"] }],
};

function fixture(metadata = false, dev = 0n) {
  let now = start;
  let pathStat: CaptureStat = {
    dev,
    ino: 2n,
    ctimeNs: 10_000_000_001n,
    mtimeNs: 10_000_000_001n,
    size: 4n,
    isDirectory: () => !metadata,
    isFile: () => metadata,
    isSymbolicLink: () => false,
  };
  let openedStat: CaptureStat = { ...pathStat, dev: serial };
  const reads: string[] = [];
  const runtime: CaptureRuntime = {
    platform: "win32",
    now: () => now,
    wait: async () => {
      throw new Error("unexpected barrier");
    },
    lstat: async () => {
      reads.push("lstat");
      return pathStat;
    },
    stat: async () => {
      reads.push("stat");
      return pathStat;
    },
    readlink: async () => {
      throw new Error("unexpected link read");
    },
    handleStat: async () => {
      reads.push("handle");
      return openedStat;
    },
    filesystem: async () => {
      throw new Error("Windows must use its volume hint");
    },
  };
  return {
    runtime,
    reads,
    path: () => pathStat,
    opened: () => openedStat,
    changePath: (value: Partial<CaptureStat>) => {
      pathStat = { ...pathStat, ...value };
    },
    changeHandle: (value: Partial<CaptureStat>) => {
      openedStat = { ...openedStat, ...value };
    },
    advance: () => {
      now += 100_000_000n;
    },
  };
}

test("Windows witnesses use the handle serial and keep metadata's original handle snapshot", async () => {
  for (const [name, follow, metadata] of [
    ["directory", false, false],
    ["linked directory", true, false],
    ["metadata", true, true],
  ] satisfies Array<[string, boolean, boolean]>) {
    const io = fixture(metadata);
    const capture = new CaptureDurability(hint, io.runtime);
    if (name === "linked directory") await capture.target(file);
    else
      await capture.observe(
        file,
        metadata ? io.opened() : io.path(),
        follow,
        metadata,
      );
    const openedAtFirstTouch = io.reads.includes("handle");
    assert.equal(await capture.finish(), true, name);
    assert.equal(openedAtFirstTouch, !metadata, name);
    assert.equal(io.reads.includes(follow ? "lstat" : "stat"), false, name);
  }
});

test("Windows witnesses reject a different handle and a replacement directory link", async () => {
  for (const when of ["first touch", "finish"]) {
    for (const change of [
      "handle identity",
      "handle ctime",
      "handle mtime",
      "handle kind",
      "path identity",
      "path link",
    ]) {
      const io = fixture(false, serial);
      const capture = new CaptureDurability(hint, io.runtime);
      if (when === "finish") await capture.observe(file, io.path(), false);
      const original = io.runtime.handleStat;
      io.runtime.handleStat = async (selected) => {
        if (change === "handle identity") io.changeHandle({ ino: 3n });
        if (change === "handle ctime") io.changeHandle({ ctimeNs: 3n });
        if (change === "handle mtime") io.changeHandle({ mtimeNs: 3n });
        if (change === "handle kind")
          io.changeHandle({ isDirectory: () => false, isFile: () => true });
        if (change === "path identity") io.changePath({ ino: 3n });
        if (change === "path link")
          io.changePath({
            isDirectory: () => false,
            isSymbolicLink: () => true,
          });
        return original(selected);
      };
      if (when === "first touch") await capture.observe(file, io.path(), false);
      assert.equal(await capture.finish(), false, `${when}: ${change}`);
    }
  }
  const io = fixture(false, serial);
  const capture = new CaptureDurability(hint, io.runtime);
  await capture.observe(file, io.path(), false);
  io.changePath({ isDirectory: () => false, isSymbolicLink: () => true });
  assert.equal(
    await capture.finish(),
    false,
    "a link exists before the recheck",
  );
  assert.equal(io.reads.filter((read) => read === "handle").length, 1);
});

test("Windows handle failures keep physical evidence complete and close every opened witness", async (context) => {
  let failure = "";
  const reads: string[] = [];
  const io = fixture(false, serial);
  context.mock.method(fs, "open", async (selected: string, flags: string) => {
    assert.equal(selected, file);
    assert.equal(flags, "r");
    reads.push("open");
    if (failure === "open")
      throw Object.assign(new Error("open failed"), { code: "ENOENT" });
    return {
      stat: async (options: { bigint: boolean }) => {
        assert.deepEqual(options, { bigint: true });
        reads.push("stat");
        if (failure === "stat")
          throw Object.assign(new Error("stat failed"), { code: "EPERM" });
        return io.opened();
      },
      close: async () => {
        reads.push("close");
        if (failure === "close") throw new Error("close failed");
      },
    };
  });
  io.runtime.handleStat = captureRuntime.handleStat;
  class Inputs extends PhysicalInputs {
    protected override async linkTarget(selected: string) {
      if (selected === file)
        await this.durability?.observe(selected, io.path(), false);
      return undefined;
    }

    protected override async readFilePath(
      selected: string,
    ): Promise<FilePathProbe> {
      return { kind: "file", path: selected };
    }
  }
  for (const when of ["first touch", "finish"]) {
    for (const operation of ["open", "stat", "close"]) {
      reads.length = 0;
      failure = when === "first touch" ? operation : "";
      const capture = new CaptureDurability(hint, io.runtime);
      const inputs = new Inputs(capture);
      assert.equal(await inputs.exactFile(file), true);
      if (when === "finish") {
        failure = operation;
        reads.length = 0;
      }
      assert.equal(await capture.finish(), false, `${when}: ${operation}`);
      assert.equal(inputs.complete, true, `${when}: ${operation}`);
      assert.deepEqual(
        reads,
        operation === "open" ? ["open"] : ["open", "stat", "close"],
        `${when}: ${operation}`,
      );
    }
  }
});

test("Windows handle latency cannot mature a stamp that was recent at first touch", async () => {
  const io = fixture();
  io.changePath({ ctimeNs: start - 1n });
  io.changeHandle({ ctimeNs: start - 1n });
  const capture = new CaptureDurability(hint, io.runtime);
  const original = io.runtime.handleStat;
  io.runtime.handleStat = async (selected) => {
    io.advance();
    return original(selected);
  };
  await capture.observe(file, io.path(), false);
  assert.equal(await capture.finish(), false);
});
