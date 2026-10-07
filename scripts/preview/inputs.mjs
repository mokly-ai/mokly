import crypto from "node:crypto";
import path from "node:path";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { compileCatalogue } from "../../dist/build/compile.js";
import { generatedBytes } from "../../dist/build/generated_file.js";
import {
  publicationFiles,
  publicationInput,
  readPublicationFile,
} from "../../dist/publication/files.js";

/** Capture metadata and its exact input digest together, including private helpers. */
export async function capturePublicationInputs(
  config,
  excludedRoots,
  compilation,
) {
  compilation ??= await compileCatalogue(config);
  const files = new Map();
  for (const [root, publicRoot] of [
    [config.repoRoot, false],
    [config.mockupsDir, true],
  ])
    for (const file of await publicationFiles(
      config,
      root,
      excludedRoots,
      publicRoot,
    ))
      if (
        !compilation.outputs.has(
          path
            .relative(config.generatedDir, file.path)
            .split(path.sep)
            .join("/"),
        )
      )
        files.set(file.path, file);
  const manifest = compilation.manifest;
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
      hash.update(await readPublicationFile(file, config.repoRoot));
    hash.update("\0");
  }
  for (const [route, content] of [...compilation.outputs].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    hash.update(`${GENERATED_DIRECTORY}/${route}\0`);
    hash.update(generatedBytes(content));
    hash.update("\0");
  }
  return { fingerprint: hash.digest("hex"), manifest };
}
