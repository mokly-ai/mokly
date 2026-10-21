import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { constants } from "node:os";
import path from "node:path";

import { x as extractTar } from "tar";

import { runInherited } from "./process.mjs";

const release = {
  version: "0.22.2",
  checksum: "700c2b240f7fd330c24b675fe429f73a5b676531fcc6300400b2b67f155ba12a",
};

/** Install immutable tool source with the reviewed dependency lock. */
export async function ensureRustAuditTool(
  root,
  pin = release,
  io = dependencies(root),
) {
  const lock = await io.read(path.join(root, ".cargo/audit-tool/Cargo.lock"));
  const identity = createHash("sha256")
    .update(`${io.target}:${pin.version}:${pin.checksum}:`)
    .update(lock)
    .digest("hex");
  const installation = path.join(root, ".context/rust-audit-tool", identity);
  const binary = path.join(installation, "bin", io.executable);
  const stamp = path.join(installation, "complete");
  if (
    (await io.exists(binary)) &&
    (await io.exists(stamp)) &&
    (await io.read(stamp)).trim() === identity
  )
    return binary;

  const build = await io.temporary(
    path.join(root, ".context/rust-audit-build-"),
  );
  try {
    const bytes = await io.download(
      `https://static.crates.io/crates/cargo-audit/cargo-audit-${pin.version}.crate`,
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      pin.checksum,
      "cargo-audit source checksum differs",
    );
    const archive = path.join(build, "source.crate");
    const source = path.join(build, "source");
    await io.write(archive, bytes);
    await io.extract(archive, source);
    const manifest = path.join(source, "Cargo.toml");
    await io.write(manifest, `${await io.read(manifest)}\n[workspace]\n`);
    await io.write(path.join(source, "Cargo.lock"), lock);
    const result = await io.run("cargo", [
      "install",
      "--path",
      source,
      "--locked",
      "--root",
      installation,
      "--target-dir",
      path.join(root, "target/rust-audit-tool"),
    ]);
    assert.equal(exitCode(result), 0, "cargo-audit installation failed");
    assert.ok(
      await io.exists(binary),
      "cargo-audit installation produced no binary",
    );
    await io.write(stamp, `${identity}\n`);
    return binary;
  } finally {
    await io.remove(build);
  }
}

function exitCode(result) {
  const signal = result.interrupted || result.signal;
  return signal
    ? 128 + (constants.signals[signal] ?? 1)
    : (result.exitCode ?? 1);
}

function dependencies(root) {
  return {
    target: `${process.platform}-${process.arch}`,
    executable:
      process.platform === "win32" ? "cargo-audit.exe" : "cargo-audit",
    read: (file) => fs.readFile(file, "utf8"),
    write: (file, contents) => fs.writeFile(file, contents),
    exists: async (file) => {
      try {
        await fs.access(file);
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    },
    temporary: async (prefix) => {
      await fs.mkdir(path.dirname(prefix), { recursive: true });
      return await fs.mkdtemp(prefix);
    },
    download: async (url) => {
      const response = await fetch(url);
      assert.equal(response.status, 200, "cargo-audit source download failed");
      return Buffer.from(await response.arrayBuffer());
    },
    extract: async (file, cwd) => {
      await fs.mkdir(cwd, { recursive: true });
      await extractTar({ file, cwd, strip: 1, strict: true });
    },
    remove: (directory) => fs.rm(directory, { recursive: true, force: true }),
    run: (file, args) => runInherited(file, args, { cwd: root }),
  };
}
