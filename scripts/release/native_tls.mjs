/** Inspect imported libraries and platform runtime versions without execution. */
import assert from "node:assert/strict";

import { runCommand } from "./command.mjs";
import { GLIBC_FLOOR } from "./native_build.mjs";

export function assertNoCryptoLibrary(output) {
  if (/\b(?:lib(?:ssl|crypto|aws[-_]lc|boring)|openssl)[\w.-]*/i.test(output))
    throw new Error(`native binary links a crypto shared library:\n${output}`);
}

export async function inspectNativeTls(
  binary,
  os = process.platform,
  execute = runCommand,
) {
  let output;
  if (os === "linux") {
    const dynamic = await execute("readelf", ["-d", binary]);
    const versions = await execute("readelf", [
      "--version-info",
      "--wide",
      binary,
    ]);
    const highest = highestGlibc(versions.stdout);
    assert.ok(
      compareVersions(highest, GLIBC_FLOOR) <= 0,
      `native binary requires GLIBC_${highest}, above the ${GLIBC_FLOOR} floor`,
    );
    output = `Highest GLIBC version: ${highest}\n${dynamic.stdout}\n${versions.stdout}`;
  } else if (os === "darwin") {
    output = (await execute("otool", ["-L", binary])).stdout;
  } else if (os === "win32") {
    const { stdout } = await execute("powershell", [
      "-NoProfile",
      "-Command",
      '& "${env:ProgramFiles(x86)}\\Microsoft Visual Studio\\Installer\\vswhere.exe" -latest -products * -find "VC\\Tools\\MSVC\\*\\bin\\Hostx64\\x64\\dumpbin.exe"',
    ]);
    const executable = stdout.trim().split(/\r?\n/)[0];
    if (!executable) throw new Error("Visual Studio dumpbin was not found");
    const inspected = (await execute(executable, ["/dependents", binary]))
      .stdout;
    const dlls = [...inspected.matchAll(/^\s*([\w.+-]+\.dll)\s*$/gim)].map(
      (match) => match[1],
    );
    assert.ok(dlls.length > 0, "dumpbin returned no DLL dependencies");
    assert.ok(
      !dlls.some((dll) =>
        /^(?:vcruntime|msvcp|msvcr|ucrtbase|api-ms-win-crt)/i.test(dll),
      ),
      `native binary must link the MSVC runtime statically: ${dlls.join(", ")}`,
    );
    output = `DLL imports: ${dlls.join(", ")}\n${inspected}`;
  } else throw new Error(`unsupported native inspection OS: ${os}`);
  assertNoCryptoLibrary(output);
  return output;
}

function highestGlibc(output) {
  const versions = [...output.matchAll(/\bGLIBC_([\d.]+)\b/g)].map(
    (match) => match[1],
  );
  assert.ok(versions.length > 0, "readelf returned no GLIBC requirements");
  assert.doesNotMatch(
    output,
    /\bGLIBC_(?:ABI_|PRIVATE)/,
    "native binary requires an unsupported glibc ABI",
  );
  return versions.sort(compareVersions).at(-1);
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
}
