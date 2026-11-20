import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const source = fileURLToPath(
  new URL("./base_manager_node.rs", import.meta.url),
);
const cache = fileURLToPath(
  new URL("../../.context/manager-node-launchers", import.meta.url),
);
const builds = new Map<string, Promise<string>>();

/** Publish a complete cache directory without replacing a concurrent build. */
async function compile(rootName: string, identity: string) {
  const directory = path.join(cache, identity);
  const executable = path.join(directory, "node.exe");
  if ((await fs.stat(executable).catch(() => undefined))?.isFile())
    return executable;
  await fs.mkdir(cache, { recursive: true });
  const temporary = await fs.mkdtemp(`${directory}-`);
  try {
    await execute(
      "rustc",
      [source, "--edition=2024", "-o", path.join(temporary, "node.exe")],
      {
        env: {
          ...process.env,
          MOKLY_MANAGER_NODE: process.execPath,
          MOKLY_MANAGER_ROOT_NAME: rootName,
        },
      },
    );
    try {
      await fs.rename(temporary, directory);
    } catch (error) {
      if (!(await fs.stat(executable).catch(() => undefined))?.isFile())
        throw error;
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
  return executable;
}

/** Write a native Node launcher in the bin directory beside the fixture root. */
export async function writeWindowsManagerNode(root: string, node: string) {
  const rootName = path.basename(root);
  const identity = createHash("sha256")
    .update(await fs.readFile(source))
    .update(
      JSON.stringify([
        process.execPath,
        rootName,
        process.platform,
        process.arch,
      ]),
    )
    .digest("hex");
  let build = builds.get(identity);
  if (!build) {
    build = compile(rootName, identity);
    builds.set(identity, build);
  }
  await fs.copyFile(await build, node);
}
