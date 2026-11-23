import assert from "node:assert/strict";
import test from "node:test";

import type {
  CaptureRuntime,
  CaptureStat,
} from "../packages/mokly/src/sidecar/capture-runtime.js";
import { MetadataProof } from "../packages/mokly/src/sidecar/metadata-proof.js";

function stat(kind: "directory" | "link" | "file"): CaptureStat {
  return {
    dev: 1n,
    ino: 1n,
    ctimeNs: 1n,
    mtimeNs: 1n,
    size: 1n,
    isDirectory: () => kind === "directory",
    isFile: () => kind === "file",
    isSymbolicLink: () => kind === "link",
  };
}

for (const dangling of [false, true])
  test(`a negative metadata candidate ${dangling ? "with a dangling link rejects" : "without a lexical entry accepts"} the age proof`, () => {
    const candidate = "/scope/package.json";
    const missing = () =>
      Object.assign(new Error("absent"), { code: "ENOENT" });
    const runtime: CaptureRuntime = {
      platform: "linux",
      now: () => 10_000_000_000n,
      wait: async () => {
        throw new Error("unexpected wait");
      },
      stat: (file) => {
        if (file === candidate) throw missing();
        return stat("directory");
      },
      lstat: (file) => {
        if (file === candidate) {
          if (!dangling) throw missing();
          return stat("link");
        }
        return stat("directory");
      },
      readlink: () => "/outside/package.json",
      handleStat: () => stat("directory"),
      filesystem: () => 1n,
    };
    const proof = new MetadataProof(runtime.now(), runtime);
    proof.use([{ file: candidate, regular: false }]);
    assert.equal(proof.current(), !dangling);
  });

test("a young metadata file rejects otherwise mature scope topology", () => {
  const candidate = "/scope/package.json";
  const started = 10_000_000_000n;
  const snapshot = (file: string): CaptureStat =>
    file === candidate
      ? { ...stat("file"), ctimeNs: started, mtimeNs: started }
      : stat("directory");
  const runtime: CaptureRuntime = {
    platform: "linux",
    now: () => started,
    wait: async () => {
      throw new Error("unexpected wait");
    },
    stat: snapshot,
    lstat: snapshot,
    readlink: () => {
      throw new Error("unexpected link");
    },
    handleStat: snapshot,
    filesystem: () => 1n,
  };
  const proof = new MetadataProof(started, runtime);
  proof.use([{ file: candidate, regular: true }]);
  assert.equal(proof.current(), false);
});
