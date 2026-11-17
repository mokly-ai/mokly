import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { CaptureHint } from "../packages/mokly/src/generated/sidecar/CaptureHint.js";
import { CaptureDurability } from "../packages/mokly/src/sidecar/capture-durability.js";
import type {
  CaptureRuntime,
  CaptureStat,
} from "../packages/mokly/src/sidecar/capture-runtime.js";

import { bundleParams } from "./helpers/sidecar.js";

const old = 10_000_000_001n;
const start = 20_000_000_000n;
const file = path.resolve("capture/source");
const hint: CaptureHint = { volumes: [] };

function fixture(
  values: Partial<CaptureStat> = {},
  platform: NodeJS.Platform = "linux",
) {
  let current: CaptureStat = {
    dev: 1n,
    ino: 2n,
    ctimeNs: old,
    mtimeNs: old,
    size: 4n,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false,
    ...values,
  };
  let now = start;
  let type = 0xef53n;
  const waits: number[] = [];
  const reads: string[] = [];
  const runtime: CaptureRuntime = {
    platform,
    now: () => now,
    wait: async (milliseconds) => {
      waits.push(milliseconds);
      now += BigInt(milliseconds) * 1_000_000n;
    },
    lstat: async (file) => {
      reads.push(file);
      return current;
    },
    stat: async () => current,
    handleStat: async () => current,
    filesystem: async () => type,
  };
  return {
    runtime,
    waits,
    reads,
    stat: () => current,
    change: (value: Partial<CaptureStat>) => {
      current = { ...current, ...value };
    },
    filesystem: (value: bigint) => {
      type = value;
    },
  };
}

test("capture witnesses reject changed fields and read errors without storing stamps", async () => {
  for (const field of ["dev", "ino", "ctimeNs", "mtimeNs", "size"] as const) {
    const io = fixture();
    const capture = new CaptureDurability(hint, io.runtime);
    await capture.observe(file, io.stat(), true, true);
    assert.equal(await capture.finish(), true, field);
    io.change({ [field]: io.stat()[field] + 1n });
    assert.equal(await capture.finish(), false, field);
  }
  const io = fixture();
  const capture = new CaptureDurability(hint, io.runtime);
  await capture.observe(file, io.stat(), true);
  io.runtime.stat = async () => {
    throw new Error("unreadable witness");
  };
  assert.equal(await capture.finish(), false);
});

test("capture maturity rejects recent, zero, and future stamps", async () => {
  for (const [name, values, durable] of [
    ["fine mature", {}, true],
    ["fine recent", { ctimeNs: start - 1n }, false],
    [
      "whole mature",
      { ctimeNs: 17_000_000_000n, mtimeNs: 17_000_000_000n },
      true,
    ],
    [
      "whole recent",
      { ctimeNs: 19_000_000_000n, mtimeNs: 19_000_000_000n },
      false,
    ],
    ["zero ctime", { ctimeNs: 0n }, false],
    ["zero mtime", { mtimeNs: 0n }, false],
    ["future ctime", { ctimeNs: start + 1n }, false],
    ["future mtime", { mtimeNs: start + 1n }, false],
  ] satisfies Array<[string, Partial<CaptureStat>, boolean]>) {
    const io = fixture(values);
    const capture = new CaptureDurability(hint, io.runtime);
    await capture.observe(file, io.stat(), false);
    assert.equal(await capture.finish(), durable, name);
    assert.deepEqual(io.waits, [], name);
  }
});

test("capture checks Linux types and native device and root hints again at finish", async () => {
  const cases: Array<{
    platform: NodeJS.Platform;
    file: string;
    hint: CaptureHint;
    type: bigint;
    durable: boolean;
  }> = [
    ...[0xef53n, 0x58465342n, 0x9123683en, 0x01021994n, 0x794c7630n].map(
      (type) => ({
        platform: "linux" as const,
        file,
        hint,
        type,
        durable: true,
      }),
    ),
    { platform: "linux", file, hint, type: 0x6969n, durable: false },
    { platform: "darwin", file, hint, type: 24n, durable: false },
    {
      platform: "darwin",
      file,
      hint: { volumes: [{ kind: "macos", dev: "1", fsType: 24 }] },
      type: 24n,
      durable: true,
    },
    {
      platform: "darwin",
      file,
      hint: { volumes: [{ kind: "macos", dev: "2", fsType: 24 }] },
      type: 24n,
      durable: false,
    },
    {
      platform: "darwin",
      file,
      hint: { volumes: [{ kind: "macos", dev: "1", fsType: 25 }] },
      type: 24n,
      durable: false,
    },
    {
      platform: "win32",
      file: "C:\\source\\entry.ts",
      hint: { volumes: [{ kind: "windows", dev: "1", roots: ["C:\\"] }] },
      type: 0n,
      durable: true,
    },
    {
      platform: "win32",
      file: "C:\\mounted\\entry.ts",
      hint: {
        volumes: [{ kind: "windows", dev: "1", roots: ["C:\\mount\\"] }],
      },
      type: 0n,
      durable: false,
    },
    {
      platform: "win32",
      file: "C:\\mount\\entry.ts",
      hint: {
        volumes: [{ kind: "windows", dev: "1", roots: ["C:\\mount\\"] }],
      },
      type: 0n,
      durable: true,
    },
    {
      platform: "win32",
      file: "\\\\server\\share\\entry.ts",
      hint: {
        volumes: [
          { kind: "windows", dev: "1", roots: ["\\\\server\\share\\"] },
        ],
      },
      type: 0n,
      durable: false,
    },
    {
      platform: "win32",
      file: "C:\\entry.ts",
      hint: { volumes: [{ kind: "windows", dev: "2", roots: ["C:\\"] }] },
      type: 0n,
      durable: false,
    },
  ];
  for (const item of cases) {
    const io = fixture({}, item.platform);
    io.filesystem(item.type);
    const capture = new CaptureDurability(item.hint, io.runtime);
    await capture.observe(item.file, io.stat(), false);
    assert.equal(
      await capture.finish(),
      item.durable,
      `${item.platform} ${item.file} ${item.type}`,
    );
  }
  const io = fixture();
  const capture = new CaptureDurability(hint, io.runtime);
  await capture.observe(file, io.stat(), false);
  io.filesystem(0x6969n);
  assert.equal(await capture.finish(), false, "the volume class changed");
});

test("the adaptive barrier waits once before observations and never waits for concurrent changes", async () => {
  const params = bundleParams({
    sourceRoot: file,
    entryFiles: ["entry.ts"],
    storiesFiles: ["story.ts"],
    renderer: "renderer.ts",
    configurationDirectory: "config",
  });
  for (const [name, stamp, expected] of [
    ["old", old, []],
    ["recent", start - 1n, [50]],
    ["whole second", start, [50]],
    ["concurrent", start + 1n, []],
  ] satisfies Array<[string, bigint, number[]]>) {
    const io = fixture({ ctimeNs: stamp, mtimeNs: stamp });
    const capture = new CaptureDurability(hint, io.runtime);
    await capture.prepare(params);
    assert.deepEqual(io.waits, expected, name);
    for (const required of [
      file,
      path.dirname(file),
      path.join(file, "config"),
      path.join(file, "entry.ts"),
      path.join(file, "story.ts"),
      path.join(file, "renderer.ts"),
    ])
      assert.equal(io.reads.includes(required), true, required);
    await capture.observe(file, io.stat(), false);
    assert.equal(
      await capture.finish(),
      name === "old" || name === "recent",
      name,
    );
  }
});

test("witnesses and preflight stay within the visited-path and hello bounds", async (context) => {
  const io = fixture();
  const capture = new CaptureDurability(hint, io.runtime);
  capture.budget(8 * 1024 * 1024 - Buffer.byteLength(file) - 47);
  await capture.observe(file, io.stat(), false);
  assert.equal(await capture.finish(), false);
  assert.equal(capture.bytes, 0);
  const preflight = new CaptureDurability(hint, io.runtime);
  const byteLength = Buffer.byteLength;
  context.mock.method(
    Buffer,
    "byteLength",
    (...args: Parameters<typeof Buffer.byteLength>) =>
      args[0] === file ? 8 * 1024 * 1024 + 1 : byteLength(...args),
  );
  await preflight.prepare(bundleParams({ sourceRoot: file }));
  assert.deepEqual(io.reads, []);
  assert.equal(await preflight.finish(), false);
  for (const volumes of [
    Array.from({ length: 65 }, () => ({
      kind: "macos" as const,
      dev: "1",
      fsType: 24,
    })),
    [{ kind: "windows" as const, dev: "1", roots: ["x".repeat(64 * 1024)] }],
  ]) {
    const oversized = new CaptureDurability({ volumes }, io.runtime);
    assert.equal(await oversized.finish(), false);
  }
});
