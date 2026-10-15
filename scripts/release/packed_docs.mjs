import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { list } from "tar";

/** Compare the full public documentation and changelog with their source bytes. */
export async function inspectPublishedDocs(archive, repositoryRoot) {
  const expected = new Map();
  for (const directory of ["docs/guides", "docs/protocol"]) {
    for (const file of await filesBelow(repositoryRoot, directory)) {
      expected.set(
        file,
        hash(await fs.readFile(path.join(repositoryRoot, file))),
      );
    }
  }
  expected.set(
    "CHANGELOG.md",
    hash(await fs.readFile(path.join(repositoryRoot, "CHANGELOG.md"))),
  );
  const actual = new Map();
  await list({
    file: archive,
    onReadEntry(entry) {
      const name = entry.path.replace(/^package\//, "");
      if (
        entry.type === "Directory" ||
        !(name.startsWith("docs/") || name === "CHANGELOG.md")
      )
        return;
      assert.equal(
        entry.type,
        "File",
        "published documentation must be a regular file",
      );
      assert.ok(
        !actual.has(name),
        `duplicate published documentation: ${name}`,
      );
      const digest = crypto.createHash("sha256");
      actual.set(name, null);
      entry.on("data", (chunk) => digest.update(chunk));
      entry.on("end", () => actual.set(name, digest.digest("hex")));
    },
  });
  assert.deepEqual(
    [...actual.keys()].sort(),
    [...expected.keys()].sort(),
    "published documentation must contain the complete source trees and changelog",
  );
  for (const [file, digest] of expected)
    assert.equal(
      actual.get(file),
      digest,
      `published documentation differs from source: ${file}`,
    );
}

async function filesBelow(root, directory) {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await filesBelow(root, name)));
    else {
      assert.ok(
        entry.isFile(),
        `public documentation must be a regular file: ${name}`,
      );
      files.push(name);
    }
  }
  return files;
}

function hash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}
