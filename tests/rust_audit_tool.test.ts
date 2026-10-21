import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import {
  ensureRustAuditTool,
  type RustAuditOutcome,
  type RustAuditToolDependencies,
} from "../scripts/verification/rust-audit-tool.mjs";
import { runRustAudit } from "../scripts/verification/rust-audit.mjs";

function fixture() {
  const archive = Buffer.from("verified source fixture");
  const pin = {
    version: "0.22.2",
    checksum: createHash("sha256").update(archive).digest("hex"),
  };
  const root = path.resolve("fixture-root");
  const build = path.join(root, ".context/build");
  const lockPath = path.join(root, ".cargo/audit-tool/Cargo.lock");
  const files = new Map<string, string | Buffer>([
    [lockPath, "reviewed dependencies\n"],
  ]);
  const events: string[] = [];
  const commands: Array<{ file: string; args: string[] }> = [];
  const outcomes: RustAuditOutcome[] = [];
  const io: RustAuditToolDependencies = {
    target: "linux-x64",
    executable: "cargo-audit",
    read: async (file) => {
      const value = files.get(file);
      assert.notEqual(value, undefined, file);
      return String(value);
    },
    write: async (file, value) => {
      files.set(file, value);
      events.push(`write:${file}`);
    },
    exists: async (file) => files.has(file),
    temporary: async () => build,
    download: async (url) => {
      events.push(`download:${url}`);
      return archive;
    },
    extract: async (_archive, source) => {
      events.push("extract");
      files.set(
        path.join(source, "Cargo.toml"),
        '[package]\nname = "cargo-audit"\n',
      );
    },
    remove: async (directory) => {
      events.push(`remove:${directory}`);
    },
    run: async (file, args) => {
      commands.push({ file, args });
      events.push(`run:${file}`);
      if (file === "cargo") {
        const destination = args[args.indexOf("--root") + 1]!;
        files.set(path.join(destination, "bin", io.executable), "binary");
      }
      return outcomes.shift() ?? { exitCode: 0 };
    },
  };
  return { root, pin, io, files, events, commands, outcomes, build, lockPath };
}

test("the audit tool verifies source and installs only reviewed locked dependencies", async () => {
  const f = fixture();
  const binary = await ensureRustAuditTool(f.root, f.pin, f.io);
  assert.equal(
    f.events[0],
    "download:https://static.crates.io/crates/cargo-audit/cargo-audit-0.22.2.crate",
  );
  assert.equal(
    f.files.get(path.join(f.build, "source/Cargo.lock")),
    f.files.get(f.lockPath),
  );
  assert.match(
    String(f.files.get(path.join(f.build, "source/Cargo.toml"))),
    /\[workspace\]/,
  );
  assert.deepEqual(f.commands, [
    {
      file: "cargo",
      args: [
        "install",
        "--path",
        path.join(f.build, "source"),
        "--locked",
        "--root",
        path.dirname(path.dirname(binary)),
        "--target-dir",
        path.join(f.root, "target/rust-audit-tool"),
      ],
    },
  ]);
  assert.equal(f.events.at(-1), `remove:${f.build}`);
});

test("source checksum failures cannot extract or compile unverified bytes", async () => {
  const f = fixture();
  f.io.download = async () => Buffer.from("tampered source");
  await assert.rejects(
    ensureRustAuditTool(f.root, f.pin, f.io),
    /source checksum differs/,
  );
  assert.deepEqual(f.commands, []);
  assert.deepEqual(f.events, [`remove:${f.build}`]);
});

test("a cached tool skips installation but always queries live advisories", async () => {
  const f = fixture();
  const binary = await ensureRustAuditTool(f.root, f.pin, f.io);
  f.events.length = 0;
  f.commands.length = 0;
  f.io.download = async () => {
    throw new Error("unexpected download");
  };
  const audits: Array<{ file: string; args: string[] }> = [];
  await runRustAudit({
    root: f.root,
    now: () => new Date("2026-10-21T00:00:00.000Z"),
    install: (root) => ensureRustAuditTool(root, f.pin, f.io),
    execute: async (file, args) => {
      const packages = [{ name: "lightningcss", version: "1.0.0-alpha.72" }];
      if (args[0] === "metadata")
        return { stdout: JSON.stringify({ packages }), stderr: "" };
      audits.push({ file, args });
      return { stdout: '{"settings":{"ignore":[]}}', stderr: "" };
    },
    write: () => undefined,
  });
  assert.deepEqual(f.commands, []);
  assert.deepEqual(audits, [
    { file: binary, args: ["audit", "--json", "--file", "Cargo.lock"] },
  ]);
});

test("changed locks and source pins cannot reuse an earlier tool", async () => {
  for (const change of ["lock", "version", "checksum", "target"]) {
    const f = fixture();
    const first = await ensureRustAuditTool(f.root, f.pin, f.io);
    if (change === "lock")
      f.files.set(f.lockPath, "changed locked dependencies");
    else if (change === "version") f.pin.version = "0.22.3";
    else if (change === "target") f.io.target = "darwin-arm64";
    else {
      const bytes = Buffer.from("new source");
      f.pin.checksum = createHash("sha256").update(bytes).digest("hex");
      f.io.download = async () => bytes;
    }
    const next = await ensureRustAuditTool(f.root, f.pin, f.io);
    assert.notEqual(next, first);
    assert.equal(f.commands.filter(({ file }) => file === "cargo").length, 2);
  }
});

test("a missing or incomplete completion marker requires a fresh install", async () => {
  for (const incomplete of [undefined, "", "partial"]) {
    const f = fixture();
    const binary = await ensureRustAuditTool(f.root, f.pin, f.io);
    const stamp = path.join(path.dirname(path.dirname(binary)), "complete");
    if (incomplete === undefined) f.files.delete(stamp);
    else f.files.set(stamp, incomplete);
    await ensureRustAuditTool(f.root, f.pin, f.io);
    assert.equal(f.commands.length, 2);
  }
});

test("failed and signalled installs leave no reusable success stamp", async () => {
  for (const outcome of [
    { exitCode: 2 },
    { exitCode: 0, interrupted: "SIGTERM" as const },
  ]) {
    const f = fixture();
    f.outcomes.push(outcome);
    await assert.rejects(
      ensureRustAuditTool(f.root, f.pin, f.io),
      /installation failed/,
    );
    assert.equal(
      [...f.files.keys()].some((file) => path.basename(file) === "complete"),
      false,
    );
    assert.equal(f.events.at(-1), `remove:${f.build}`);
    await ensureRustAuditTool(f.root, f.pin, f.io);
    assert.equal(f.commands.length, 2);
  }
});

test("Windows uses the executable suffix inside the isolated tool root", async () => {
  const f = fixture();
  f.io.executable = "cargo-audit.exe";
  assert.ok(
    (await ensureRustAuditTool(f.root, f.pin, f.io)).endsWith(
      "cargo-audit.exe",
    ),
  );
});
