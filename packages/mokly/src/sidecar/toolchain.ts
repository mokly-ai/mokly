import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { version } from "esbuild";

import { cooperativeYield } from "./cooperative-yield.js";
import { fileDigest } from "./file-digests.js";

let identity: Promise<string | undefined> | undefined;

/** Every sidecar process computes one stable identity for its installed program. */
export function toolchainIdentity(): Promise<string | undefined> {
  return (identity ??= computeIdentity().catch(() => undefined));
}

async function packageManifest(file: string): Promise<unknown> {
  const handle = await fs.promises.open(file, "r");
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > 1024 * 1024)
      throw new Error("toolchain manifest limit");
    const bytes = Buffer.alloc(metadata.size);
    let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length !== bytes.length || (await handle.stat()).size !== bytes.length)
      throw new Error("program changed during inventory");
    return JSON.parse(bytes.toString("utf8"));
  } finally {
    await handle.close();
  }
}

async function computeIdentity(): Promise<string> {
  const root = fs.realpathSync.native(
    path.resolve(import.meta.dirname, "../.."),
  );
  const manifest = await packageManifest(path.join(root, "package.json"));
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("version" in manifest) ||
    typeof manifest.version !== "string"
  )
    throw new Error("missing Mokly version");
  const hash = createHash("sha256").update(
    JSON.stringify([root, manifest.version, version, process.version]),
  );
  const files: string[] = [];
  let namesBytes = 0;
  const visit = async (directory: string): Promise<void> => {
    for (const entry of fs.readdirSync(path.join(root, "dist", directory), {
      withFileTypes: true,
    })) {
      const pause = cooperativeYield();
      if (pause) await pause;
      const file = path.join(directory, entry.name);
      namesBytes += Buffer.byteLength(file);
      if (namesBytes > 8 * 1024 * 1024 || files.length >= 100_000)
        throw new Error("toolchain inventory limit");
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() || entry.isSymbolicLink()) files.push(file);
      else throw new Error("unsupported program entry");
    }
  };
  await visit("");
  for (const file of files.sort()) {
    const digest = await fileDigest(path.join(root, "dist", file));
    if (digest === null) throw new Error("program changed during inventory");
    hash.update(JSON.stringify([file.replaceAll(path.sep, "/"), digest]));
  }
  return hash.digest("hex");
}
