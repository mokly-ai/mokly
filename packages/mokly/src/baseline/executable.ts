import fs from "node:fs/promises";
import path from "node:path";

import type { BaselineProcessRequest } from "./types.js";

/** Locate executable files without running an interactive shell or a package shim. */
export interface BaselineExecutableHost {
  readonly platform: NodeJS.Platform;
  readonly nodeExecutable: string;
  isFile(file: string): Promise<boolean>;
}

export interface BaselineExecutableResolver {
  resolve(request: BaselineProcessRequest): Promise<readonly string[]>;
}

class NodeExecutableHost implements BaselineExecutableHost {
  readonly platform = process.platform;
  readonly nodeExecutable = process.execPath;
  async isFile(file: string): Promise<boolean> {
    try {
      return (await fs.stat(file)).isFile();
    } catch (error) {
      if (
        ["ENOENT", "ENOTDIR"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        )
      )
        return false;
      throw error;
    }
  }
}

/** Preserve Windows launcher precedence; translate only the selected npm/npx cmd shim. */
export class NodeBaselineExecutableResolver implements BaselineExecutableResolver {
  constructor(
    private readonly host: BaselineExecutableHost = new NodeExecutableHost(),
  ) {}

  async resolve(request: BaselineProcessRequest): Promise<readonly string[]> {
    const [executable = "", ...args] = request.argv;
    const basename = path.win32.basename(executable);
    const command = /^(npm|npx)(?:\.cmd)?$/i.exec(basename)?.[1]?.toLowerCase();
    if (this.host.platform !== "win32" || !command) return request.argv;
    const directories =
      basename !== executable
        ? [path.win32.dirname(path.win32.resolve(request.cwd, executable))]
        : [
            request.cwd,
            ...(environmentValue(request.env, "PATH") ?? "")
              .split(";")
              .filter(Boolean)
              .map((directory) =>
                path.win32.resolve(
                  request.cwd,
                  directory.replace(/^"(.*)"$/, "$1"),
                ),
              ),
          ];
    const extensions = basename.toLowerCase().endsWith(".cmd")
      ? [".cmd"]
      : (environmentValue(request.env, "PATHEXT") || ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .map((extension) => extension.trim().toLowerCase())
          .filter((extension) => /^\.[a-z0-9]+$/.test(extension));
    for (const directory of directories) {
      for (const extension of extensions) {
        const launcher = path.win32.join(directory, `${command}${extension}`);
        if (!(await this.host.isFile(launcher))) continue;
        if (extension === ".exe" || extension === ".com")
          return [launcher, ...args];
        if (extension !== ".cmd")
          throw new Error(`Unsupported Windows baseline launcher: ${launcher}`);
        return [...(await this.cmdEntrypoint(directory, command)), ...args];
      }
    }
    throw new Error(`Cannot find ${command} on the baseline command PATH`);
  }

  private async cmdEntrypoint(
    directory: string,
    command: string,
  ): Promise<readonly string[]> {
    const scripts = [
      path.win32.join(
        directory,
        "node_modules",
        "npm",
        "bin",
        `${command}-cli.js`,
      ),
    ];
    if (path.win32.basename(directory).toLowerCase() === ".bin")
      scripts.push(
        path.win32.join(directory, "..", "npm", "bin", `${command}-cli.js`),
      );
    for (const script of scripts) {
      if (!(await this.host.isFile(script))) continue;
      const adjacentNode = path.win32.join(directory, "node.exe");
      const node = (await this.host.isFile(adjacentNode))
        ? adjacentNode
        : this.host.nodeExecutable;
      return [node, script];
    }
    throw new Error(
      `Cannot find the ${command} JavaScript entry point beside ${directory}`,
    );
  }
}

function environmentValue(
  environment: Readonly<Record<string, string>>,
  name: string,
): string | undefined {
  const key = Object.keys(environment)
    .sort()
    .find((key) => key.toUpperCase() === name);
  return key === undefined ? undefined : environment[key];
}
