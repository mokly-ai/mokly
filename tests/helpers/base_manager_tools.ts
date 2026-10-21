import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { write } from "./static_changes.js";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);

export const managers = [
  { name: "pnpm", package: "pnpm", version: "10.34.7", cli: "bin/pnpm.cjs" },
  {
    name: "Yarn Classic",
    package: "yarn",
    version: "1.22.22",
    cli: "bin/yarn.js",
  },
  {
    name: "Yarn Berry",
    package: "@yarnpkg/cli-dist",
    version: "4.18.1",
    cli: "bin/yarn.js",
  },
  {
    name: "pnpm 11",
    package: "pnpm-modern",
    version: "11.20.0",
    cli: "bin/pnpm.mjs",
  },
  {
    name: "pnpm 12",
    package: "pnpm-native",
    version: "12.14.0",
    cli: "bin/pnpm.mjs",
  },
] as const;

export type Manager = (typeof managers)[number];

export function managerName(manager: Manager) {
  return manager.name.startsWith("pnpm") ? "pnpm" : "yarn";
}

function directory(manager: Manager) {
  return path.dirname(
    require.resolve(
      manager.package === "pnpm" || manager.package === "pnpm-modern"
        ? manager.package
        : `${manager.package}/package.json`,
    ),
  );
}

/** The pinned development CLI of a manager, run with the current Node. */
export function cli(manager: Manager) {
  return path.join(directory(manager), manager.cli);
}

export async function installFixture(
  root: string,
  manager: Manager,
  env: NodeJS.ProcessEnv,
) {
  const args =
    managerName(manager) === "pnpm"
      ? [
          "install",
          "--offline",
          "--ignore-scripts",
          "--ignore-pnpmfile",
          "--config.pm-on-fail=ignore",
          "--config.manage-package-manager-versions=false",
          "--store-dir",
          path.join(root, ".context/store"),
        ]
      : manager.name === "Yarn Classic"
        ? [
            "install",
            "--offline",
            "--ignore-scripts",
            "--non-interactive",
            "--cache-folder",
            path.join(root, ".context/yarn-cache"),
          ]
        : ["install", "--mode=skip-build"];
  await execute(process.execPath, [cli(manager), ...args], {
    cwd: root,
    env: {
      ...env,
      HOME: path.join(root, ".context/manager-home"),
      LOCALAPPDATA: path.join(root, ".context/manager-home"),
      XDG_CACHE_HOME: path.join(root, ".context/manager-home"),
      YARN_ENABLE_IMMUTABLE_INSTALLS: "false",
      YARN_ENABLE_NETWORK: "false",
      YARN_ENABLE_TELEMETRY: "false",
    },
  });
}

export async function managerPath(
  root: string,
  manager: Manager,
  missing: boolean,
) {
  const bin = path.join(path.dirname(root), "bin");
  await fs.mkdir(bin, { recursive: true });
  const node = path.join(
    bin,
    process.platform === "win32" ? "node.exe" : "node",
  );
  if (process.platform === "win32") await fs.copyFile(process.execPath, node);
  else await fs.symlink(process.execPath, node);
  if (!missing) {
    const name = managerName(manager);
    if (process.platform === "win32") {
      await write(bin, `${name}.cmd`, "@echo off\n");
      const target = path.join(
        bin,
        "node_modules",
        name === "pnpm" ? "pnpm" : manager.package,
      );
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.symlink(directory(manager), target, "junction");
    } else if (manager.package === "pnpm-native") {
      await fs.writeFile(
        path.join(bin, name),
        `#!/usr/bin/env node\nvoid import(${JSON.stringify(pathToFileURL(cli(manager)).href)});\n`,
        { mode: 0o755 },
      );
    } else {
      await fs.symlink(cli(manager), path.join(bin, name));
    }
  }
  const original = (process.env.PATH ?? "").split(path.delimiter);
  const safe: string[] = [bin];
  for (const directory of original) {
    if (!path.isAbsolute(directory)) continue;
    const files = await fs.readdir(directory).catch(() => []);
    if (
      files.some((file) =>
        /^(pnpm|yarn|corepack)(\.(cmd|exe|bat|com))?$/iu.test(file),
      )
    )
      continue;
    safe.push(directory);
  }
  return safe.join(path.delimiter);
}

/**
 * Count real manager installs and reject any attempted socket connection,
 * except to the local registry `port` when one is given.
 */
export async function instrumentManagers(root: string, port?: number) {
  const preload = path.join(root, ".context/manager-probe.cjs");
  const calls = path.join(root, ".context/manager-calls.jsonl");
  const output = path.join(root, ".context/manager-output.log");
  const network = path.join(root, ".context/manager-network.log");
  await fs.writeFile(calls, "");
  await fs.writeFile(output, "");
  await fs.writeFile(network, "");
  await fs.writeFile(
    preload,
    `
const fs = require('node:fs');
const net = require('node:net');
const allowed = ${JSON.stringify(port ?? null)};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const target = Array.isArray(args[0]) ? args[0][0] : typeof args[0] === 'object' && args[0] !== null ? args[0] : { port: args[0], host: args[1] };
  if (allowed !== null && Number(target?.port) === allowed && ['127.0.0.1', 'localhost'].includes(target?.host)) return connect.apply(this, args);
  fs.appendFileSync(${JSON.stringify(network)}, 'attempted\\n'); throw new Error('network is forbidden in this fixture');
};
if (/[/\\\\](pnpm(?:\\.(cjs|mjs))?|yarn\\.js)$/.test(process.argv[1] ? fs.realpathSync(process.argv[1]) : '') && process.argv.includes('install')) {
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n');
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream);
    stream.write = function (chunk, ...rest) { fs.appendFileSync(${JSON.stringify(output)}, chunk); return write(chunk, ...rest); };
  }
}
`,
  );
  return {
    calls,
    output,
    network,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${JSON.stringify(preload)}`,
  };
}
