/** Install pinned Linux release tools after verifying the Zig archive checksum. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { runCommand } from "./command.mjs";

const archives = {
  x64: [
    "x86_64",
    "02aa270f183da276e5b5920b1dac44a63f1a49e55050ebde3aecc9eb82f93239",
  ],
  arm64: [
    "aarch64",
    "958ed7d1e00d0ea76590d27666efbf7a932281b3d7ba0c6b01b0ff26498f667f",
  ],
};
assert.equal(process.platform, "linux");
assert.ok(archives[process.arch], "Linux release tools require x64 or ARM64");
const [architecture, checksum] = archives[process.arch];
const root = path.resolve(import.meta.dirname, "../..");
const destination = path.join(root, ".context/release-tools");
await fs.mkdir(destination, { recursive: true });
const name = `zig-${architecture}-linux-0.15.2`;
const response = await fetch(
  `https://ziglang.org/download/0.15.2/${name}.tar.xz`,
);
assert.equal(response.status, 200, "Zig download failed");
const bytes = Buffer.from(await response.arrayBuffer());
assert.equal(
  crypto.createHash("sha256").update(bytes).digest("hex"),
  checksum,
  "Zig checksum differs",
);
const archive = path.join(destination, `${name}.tar.xz`);
await fs.writeFile(archive, bytes);
await runCommand("tar", ["-xf", archive, "-C", destination]);
await fs.rm(archive);
await runCommand(
  "cargo",
  [
    "install",
    "--locked",
    "--version",
    "0.23.4",
    "cargo-zigbuild",
    "--root",
    destination,
    "--target-dir",
    path.join(root, "target/release-tools"),
  ],
  { cwd: root },
);
const paths = [path.join(destination, "bin"), path.join(destination, name)];
if (process.env.GITHUB_PATH)
  await fs.appendFile(process.env.GITHUB_PATH, paths.join("\n") + "\n");
process.stdout.write(`Release tool paths:\n${paths.join("\n")}\n`);
