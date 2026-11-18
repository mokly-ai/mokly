import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function preserveGitPrograms(bin: string, original: string[]) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  for (const name of ["git", "git-lfs"] as const) {
    const source = await findGitProgram(name, original);
    if (source) await linkProgram(source, path.join(bin, `${name}${suffix}`));
  }
}

export async function findGitProgram(
  name: "git" | "git-lfs",
  original: string[],
) {
  const suffix = process.platform === "win32" ? ".exe" : "";
  for (const directory of original) {
    if (!path.isAbsolute(directory)) continue;
    const source = path.join(directory, `${name}${suffix}`);
    const file = await fs.stat(source).catch(() => undefined);
    if (!file?.isFile()) continue;
    const executable = await fs.access(source, fs.constants.X_OK).then(
      () => true,
      () => false,
    );
    if (executable) return source;
  }
}

export async function linkProgram(source: string, target: string) {
  if (process.platform !== "win32") {
    await fs.symlink(source, target);
    return;
  }
  // Rust starts Git by name, so Windows needs an executable launcher.
  // Keep Git at its original path so it can find its DLLs and resources.
  const code = `${target}.cs`;
  await fs.writeFile(
    code,
    `using System;
using System.Diagnostics;
public static class Program {
  public static int Main() {
    string line = Environment.CommandLine;
    int end = line[0] == '"' ? line.IndexOf('"', 1) + 1 : line.IndexOf(' ');
    string args = end < 0 ? "" : line.Substring(end);
    using (Process child = Process.Start(new ProcessStartInfo(${JSON.stringify(source)}, args) { UseShellExecute = false })) {
      child.WaitForExit();
      return child.ExitCode;
    }
  }
}
`,
  );
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  try {
    await execute(
      path.join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe",
      ),
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$ErrorActionPreference = 'Stop'; Add-Type -Path ${quote(code)} -OutputAssembly ${quote(target)} -OutputType ConsoleApplication`,
      ],
    );
  } finally {
    await fs.rm(code, { force: true });
  }
}
