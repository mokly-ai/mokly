import crypto from "node:crypto";
import path from "node:path";

import { isOwned } from "../../dist/build/ownership.js";
import {
  publicationFiles,
  publicationInput,
  readPublicationFile,
} from "../../dist/publication/files.js";
import { MANIFEST_NAME, parseManifest } from "../../dist/registry/manifest.js";

/** Capture metadata and its exact input digest together, including private helpers. */
export async function capturePublicationInputs(config, excludedRoots) {
  const files = new Map();
  const enumerated = [];
  const excludes =
    config.generatedOutput === "derived"
      ? [...excludedRoots, path.join(config.mockupsDir, "mokly-generated")]
      : excludedRoots;
  for (const [root, publicRoot] of [
    [config.repoRoot, false],
    [config.mockupsDir, true],
  ])
    enumerated.push(
      ...(await publicationFiles(config, root, excludes, publicRoot)),
    );
  const manifestFile = path.join(config.mockupsDir, MANIFEST_NAME);
  const input = await publicationInput(manifestFile, config.repoRoot);
  const manifestBytes = await readPublicationFile(input, config.repoRoot);
  const manifest = parseManifest(JSON.parse(manifestBytes.toString("utf8")));
  const ownershipConfig =
    config.generatedOutput === "derived"
      ? { ...config, sourceFiles: manifest.sourceFiles }
      : config;
  for (const file of enumerated)
    if (
      config.generatedOutput !== "derived" ||
      !isOwned(file.path, ownershipConfig)
    )
      files.set(file.path, file);
  files.set(manifestFile, input);
  for (const source of [
    ...manifest.sourceFiles,
    ...(config.configSourceFiles ?? []),
  ]) {
    const file = await publicationInput(
      path.resolve(config.repoRoot, source),
      config.repoRoot,
    );
    files.set(file.path, file);
  }
  const hash = crypto.createHash("sha256");
  for (const [name, file] of [...files].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    hash.update(path.relative(config.repoRoot, name));
    hash.update("\0");
    hash.update(file.kind);
    hash.update("\0");
    if (file.link !== undefined) hash.update(file.link);
    hash.update("\0");
    if (file.kind === "file")
      hash.update(
        name === manifestFile
          ? manifestBytes
          : await readPublicationFile(file, config.repoRoot),
      );
    hash.update("\0");
  }
  return { fingerprint: hash.digest("hex"), manifest };
}
