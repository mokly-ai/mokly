import assert from "node:assert/strict";
import path from "node:path";

export const GLIBC_FLOOR = "2.28";

/** Release builds run on their target host, with an explicit runtime floor. */
export function nativeBuild(root, target, host = process) {
  assert.equal(
    host.platform,
    target.os,
    "native release build requires the target OS",
  );
  assert.equal(
    host.arch,
    target.cpu,
    "native release build requires the target architecture",
  );
  const targetDir = path.join(root, "target/release-native");
  const linux = target.os === "linux";
  return {
    file: "cargo",
    args: [
      linux ? "zigbuild" : "build",
      "--locked",
      "--release",
      "--package",
      "mokly-cli",
      "--bin",
      "mokly",
      "--target",
      linux ? `${target.triple}.${GLIBC_FLOOR}` : target.triple,
      "--target-dir",
      targetDir,
    ],
    options: {
      cwd: root,
      ...(target.os === "win32"
        ? {
            env: {
              CARGO_ENCODED_RUSTFLAGS: "-C\u001ftarget-feature=+crt-static",
            },
          }
        : {}),
    },
    binary: path.join(targetDir, target.triple, "release", target.executable),
  };
}
