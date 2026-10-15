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
    if (target.os === "darwin")
      assert.equal(command.options.env?.MACOSX_DEPLOYMENT_TARGET, "11.0");
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

const macosHeaders = (minimum: string) => `Load command 9
      cmd LC_BUILD_VERSION
  cmdsize 32
 platform MACOS
    minos ${minimum}
      sdk 26.0
   ntools 1
Load command 10
      cmd LC_SOURCE_VERSION
  cmdsize 16
  version 99.0
`;

test("macOS inspection records minos and invokes both otool inspections", async () => {
  const calls: string[][] = [];
  const output = await inspectNativeTls(
    "/a b/mokly",
    "darwin",
    async (file, args) => {
      calls.push([file, ...args]);
      return {
        stdout:
          args[0] === "-L"
            ? "/usr/lib/libSystem.B.dylib"
            : macosHeaders("11.0"),
        stderr: "",
      };
    },
  );
  assert.match(output, /macOS minos: 11\.0/);
  assert.deepEqual(calls, [
    ["otool", "-L", "/a b/mokly"],
    ["otool", "-l", "/a b/mokly"],
  ]);
  for (const headers of [
    macosHeaders("11.0.1"),
    macosHeaders("12.0"),
    "",
    macosHeaders("11.0") + macosHeaders("14.0"),
  ])
    await assert.rejects(
      inspectNativeTls("binary", "darwin", async (_file, args) => ({
        stdout: args[0] === "-L" ? "/usr/lib/libSystem.B.dylib" : headers,
        stderr: "",
      })),
      /macOS|minos/,
    );
  const legacy =
    "Load command 4\n      cmd LC_VERSION_MIN_MACOSX\n  cmdsize 16\n  version 10.15\n      sdk 26.0\n";
  assert.match(
    await inspectNativeTls("binary", "darwin", async (_file, args) => ({
      stdout: args[0] === "-L" ? "/usr/lib/libSystem.B.dylib" : legacy,
      stderr: "",
    })),
    /macOS minos: 10\.15/,
  );
  await assert.rejects(
    inspectNativeTls("binary", "darwin", async (_file, args) => ({
      stdout: args[0] === "-L" ? "libcrypto.dylib" : macosHeaders("11.0"),
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
