/** Inspect dynamic dependencies without executing a cross-compiled binary. */
import { runCommand } from "./command.mjs";

export function assertNoCryptoLibrary(output) {
  if (/\b(?:lib(?:ssl|crypto|aws[-_]lc|boring)|openssl)[\w.-]*/i.test(output))
    throw new Error(`native binary links a crypto shared library:\n${output}`);
}

export async function inspectNativeTls(binary, os = process.platform) {
  let result;
  if (os === "linux") result = await runCommand("readelf", ["-d", binary]);
  else if (os === "darwin") result = await runCommand("otool", ["-L", binary]);
  else if (os === "win32") {
    const { stdout } = await runCommand("powershell", [
      "-NoProfile",
      "-Command",
      '& "${env:ProgramFiles(x86)}\\Microsoft Visual Studio\\Installer\\vswhere.exe" -latest -products * -find "VC\\Tools\\MSVC\\*\\bin\\Hostx64\\x64\\dumpbin.exe"',
    ]);
    const executable = stdout.trim().split(/\r?\n/)[0];
    if (!executable) throw new Error("Visual Studio dumpbin was not found");
    result = await runCommand(executable, ["/dependents", binary]);
  } else throw new Error(`unsupported native inspection OS: ${os}`);
  assertNoCryptoLibrary(result.stdout);
  return result.stdout;
}
