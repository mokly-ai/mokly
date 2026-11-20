/** Exact-byte comparison between two independent catalogue builds. */

import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";

import { readCatalogueIndex } from "@mokly/viewer";
import {
  VIEWER_DIRECTORY,
  currentDocumentPath,
  documentRoute,
  entryRoute,
  viewRoute,
} from "@mokly/viewer/data";

const recovery = "Run npm run mockups:build from the repository root.";

/** @typedef {{output: string, snapshots: string, rebuild: () => Promise<void>}} DeterminismInput */
/** @typedef {import("@mokly/viewer").CatalogueReadModel} CatalogueReadModel */

/** Read regular files only, retaining exact binary bytes and path identity. */
async function outputFiles(/** @type {string} */ root, prefix = "") {
  /** @type {Map<string, import("node:buffer").Buffer>} */
  const files = new Map();
  for (const entry of await readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      for (const [file, bytes] of await outputFiles(root, relative))
        files.set(file, bytes);
    } else if (entry.isFile()) {
      files.set(relative, await readFile(path.join(root, relative)));
    } else {
      throw new Error("Unsupported build output: " + relative);
    }
  }
  return files;
}

/**
 * The output-relative document of every view, page and Markdown document that
 * the catalogue index lists, through the viewer's public route functions.
 */
function indexedDocuments(/** @type {CatalogueReadModel} */ index) {
  return [
    ...[...index.screens, ...index.components].flatMap((record) =>
      record.views.map((view) =>
        viewRoute(record.path, view.viewport, view.colorScheme),
      ),
    ),
    ...index.pages.map((page) => entryRoute(page.path)),
    ...index.documents.flatMap((document) =>
      document.colorSchemes.map((scheme) =>
        documentRoute(document.path, scheme),
      ),
    ),
  ].map(currentDocumentPath);
}

/**
 * A first build must exist before any policy or browser module loads: the
 * catalogue index, which the viewer's own reader validates, and every
 * rendered document that the index lists.
 */
async function requireOutput(/** @type {string} */ output) {
  try {
    if (!(await lstat(output)).isDirectory())
      throw new Error("Invalid output directory");
    const index = readCatalogueIndex(
      JSON.parse(
        await readFile(
          path.join(output, VIEWER_DIRECTORY, "index.json"),
          "utf8",
        ),
      ),
    );
    for (const document of indexedDocuments(index)) {
      if (!(await lstat(path.join(output, document))).isFile())
        throw new Error("Invalid document " + document);
    }
  } catch (error) {
    const missing =
      error instanceof Error && "code" in error && error.code === "ENOENT";
    throw new Error(
      "Mockup output is " + (missing ? "missing. " : "invalid. ") + recovery,
      { cause: error },
    );
  }
}

/** Compare every file and remove only the private snapshot owned by this call. */
export async function checkBuildDeterminism(
  /** @type {DeterminismInput} */ input,
) {
  await requireOutput(input.output);
  await mkdir(input.snapshots, { recursive: true });
  const owned = await mkdtemp(path.join(input.snapshots, "run-"));
  try {
    const first = path.join(owned, "first");
    await cp(input.output, first, { recursive: true, dereference: false });
    const before = await outputFiles(first);
    await input.rebuild();
    const after = await outputFiles(input.output);
    const differences = [
      ["missing", [...before.keys()].filter((file) => !after.has(file))],
      ["extra", [...after.keys()].filter((file) => !before.has(file))],
      [
        "changed",
        [...before.keys()].filter((file) => {
          const next = after.get(file);
          return next !== undefined && !before.get(file)?.equals(next);
        }),
      ],
    ];
    const messages = differences.flatMap(([kind, files]) => {
      const names = /** @type {string[]} */ (files);
      return names.length ? [kind + ":\n  " + names.sort().join("\n  ")] : [];
    });
    if (messages.length)
      throw new Error(
        "Independent mockup builds differ:\n" +
          messages.join("\n") +
          "\nRun npm run mockups:build after source changes. Then run the tests again.",
      );
  } finally {
    await rm(owned, { recursive: true, force: true });
  }
}
