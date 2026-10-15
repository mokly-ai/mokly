import assert from "node:assert/strict";
import test from "node:test";

import { nativeBuild } from "../scripts/release/native_build.mjs";
import { inspectNativeTls } from "../scripts/release/native_tls.mjs";
import { NATIVE_TARGETS } from "../scripts/release/targets.mjs";

test("native release commands enforce the host, glibc floor, and static MSVC runtime", () => {
  for (const target of NATIVE_TARGETS) {
    const command = nativeBuild("/source", target, {
      platform: target.os,
      arch: target.cpu,
    });
    assert.equal(command.file, "cargo");
    assert.ok(command.args.includes("--locked"));
    assert.ok(command.args.includes("--release"));
    const triple = command.args[command.args.indexOf("--target") + 1];
    assert.equal(
      triple,
      target.os === "linux" ? `${target.triple}.2.28` : target.triple,
    );
    assert.equal(command.args[0], target.os === "linux" ? "zigbuild" : "build");
    if (target.os === "win32")
      assert.equal(
        command.options.env?.CARGO_ENCODED_RUSTFLAGS,
        "-C\u001ftarget-feature=+crt-static",
      );
    assert.throws(
      () =>
        nativeBuild("/source", target, { platform: "other", arch: target.cpu }),
      /target OS/,
    );
    assert.throws(
      () =>
        nativeBuild("/source", target, { platform: target.os, arch: "other" }),
      /target architecture/,
    );
  }
});

test("Linux inspection records the highest numeric GLIBC version and rejects newer runtimes", async () => {
  const calls: string[][] = [];
  const execute = async (file: string, args: string[]) => {
    calls.push([file, ...args]);
    return {
      stdout:
        args[0] === "-d"
          ? "libc.so.6\nlibm.so.6"
          : "GLIBC_2.9 GLIBC_2.28 GLIBC_2.2.5",
      stderr: "",
    };
  };
  assert.match(
    await inspectNativeTls("/bin/mokly", "linux", execute),
    /Highest GLIBC version: 2.28/,
  );
  assert.deepEqual(calls, [
    ["readelf", "-d", "/bin/mokly"],
    ["readelf", "--version-info", "--wide", "/bin/mokly"],
  ]);
  for (const versions of [
    "GLIBC_2.34",
    "GLIBC_2.28.1",
    "",
    "GLIBC_2.28 GLIBC_ABI_DT_RELR",
  ]) {
    await assert.rejects(
      inspectNativeTls("binary", "linux", async (_file, args) => ({
        stdout: args[0] === "-d" ? "libc.so.6" : versions,
        stderr: "",
      })),
    );
  }
});

test("macOS inspection invokes otool and refuses crypto dependencies", async () => {
  const calls: string[][] = [];
  await inspectNativeTls("/a b/mokly", "darwin", async (file, args) => {
    calls.push([file, ...args]);
    return { stdout: "/usr/lib/libSystem.B.dylib", stderr: "" };
  });
  assert.deepEqual(calls, [["otool", "-L", "/a b/mokly"]]);
  await assert.rejects(
    inspectNativeTls("binary", "darwin", async () => ({
      stdout: "libcrypto.dylib",
      stderr: "",
    })),
    /crypto shared library/,
  );
});

test("Windows inspection locates dumpbin, records DLLs, and rejects a dynamic CRT", async () => {
  const calls: string[][] = [];
  const execute = async (file: string, args: string[]) => {
    calls.push([file, ...args]);
    return {
      stdout:
        file === "powershell"
          ? "C:\\VS Tools\\dumpbin.exe\r\n"
          : "    KERNEL32.dll\r\n    bcrypt.dll\r\n",
      stderr: "",
    };
  };
  assert.match(
    await inspectNativeTls("C:\\bin\\mokly.exe", "win32", execute),
    /DLL imports: KERNEL32.dll, bcrypt.dll/,
  );
  assert.equal(calls[0]![0], "powershell");
  assert.match(calls[0]!.at(-1)!, /vswhere\.exe.*-latest -products \* -find/);
  assert.deepEqual(calls[1], [
    "C:\\VS Tools\\dumpbin.exe",
    "/dependents",
    "C:\\bin\\mokly.exe",
  ]);
  for (const dependency of [
    "VCRUNTIME140.dll",
    "MSVCP140.dll",
    "ucrtbase.dll",
    "api-ms-win-crt-runtime-l1-1-0.dll",
    "libcrypto-3-x64.dll",
  ]) {
    await assert.rejects(
      inspectNativeTls("binary", "win32", async (file) => ({
        stdout:
          file === "powershell"
            ? "dumpbin.exe"
            : `    KERNEL32.dll\n    ${dependency}\n`,
        stderr: "",
      })),
    );
  }
  await assert.rejects(
    inspectNativeTls("binary", "win32", async () => ({
      stdout: "",
      stderr: "",
    })),
    /not found/,
  );
  await assert.rejects(
    inspectNativeTls("binary", "linux", async () => {
      throw new Error("readelf failed");
    }),
    /readelf failed/,
  );
});
