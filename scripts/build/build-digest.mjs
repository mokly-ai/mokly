import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Files read at once, below the default open-file limit of every host. */
const OPEN_FILES = 32;

/**
 * Hash every file under the given repository paths. The result maps each
 * repository-relative POSIX path to the SHA-256 of its bytes. A symbolic link
 * maps to the hash of its target text, and a missing path maps to nothing, so
 * a deleted file changes the digest. Each path can exclude direct or nested
 * entries by their path relative to it.
 */
export async function hashFiles(repositoryRoot, paths) {
  const found = [];
  for (const { path: base, exclude = [] } of paths)
    await walk(repositoryRoot, base, new Set(exclude), found);
  const hashes = new Map();
  let next = 0;
  const worker = async () => {
    while (next < found.length) {
      const { name, link } = found[next++];
      const file = path.join(repositoryRoot, ...name.split("/"));
      try {
        hashes.set(
          name,
          link
            ? `link:${sha256(await fs.readlink(file))}`
            : sha256(await fs.readFile(file)),
        );
      } catch (error) {
        // A file removed during the walk, such as an editor's temporary
        // file, is missing, like a file that was never there.
        if (error.code !== "ENOENT") throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: OPEN_FILES }, worker));
  return hashes;
}

/** Combine named parts and file hashes into one SHA-256 digest. */
export function digest(parts, hashes = new Map()) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(`part\0${part}\0`);
  for (const file of [...hashes.keys()].sort())
    hash.update(`file\0${file}\0${hashes.get(file)}\0`);
  return hash.digest("hex");
}

async function walk(repositoryRoot, base, exclude, found) {
  let metadata;
  try {
    metadata = await fs.lstat(path.join(repositoryRoot, ...base.split("/")));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (metadata.isDirectory())
    await walkDirectory(repositoryRoot, base, exclude, "", found);
  else add(found, base, metadata);
}

async function walkDirectory(repositoryRoot, base, exclude, relative, found) {
  const directory = relative ? `${base}/${relative}` : base;
  let entries;
  try {
    entries = await fs.readdir(
      path.join(repositoryRoot, ...directory.split("/")),
      { withFileTypes: true },
    );
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (exclude.has(child)) continue;
    if (entry.isDirectory())
      await walkDirectory(repositoryRoot, base, exclude, child, found);
    else add(found, `${base}/${child}`, entry);
  }
}

/** Record a file or a symbolic link; other entry kinds hold no build input. */
function add(found, name, entry) {
  if (entry.isSymbolicLink()) found.push({ name, link: true });
  else if (entry.isFile()) found.push({ name, link: false });
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
