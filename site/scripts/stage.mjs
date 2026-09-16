/**
 * Build the home stage from this repository's own example catalogue. The
 * example build runs first when its output is missing, then the Welcome
 * screen's four documents and every resource they load are copied into
 * `public/stage/` with their links rewritten to that directory, and a
 * manifest records what the home page renders.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { STAGE_DIRECTORY, parseStageManifest } from "../src/stage.ts";
import { repositoryPath } from "../src/workspace.ts";

import {
  catalogueSections,
  catalogueTrail,
  stagedEntry,
} from "./stage/catalogue.ts";
import { rewriteStage } from "./stage/fragments.ts";

const repository = repositoryPath();
const output = path.join(repository, "examples", "basic", "generated");
const stage = STAGE_DIRECTORY;

/** The catalogue route of the screen the stage shows. */
const SCREEN_ROUTE = "screens/welcome.html";

/** Every document of that screen, by the file name the site publishes. */
const DOCUMENTS = /** @type {const} */ ([
  { file: "welcome.desktop.html", scheme: "light", viewport: "desktop" },
  { file: "welcome.desktop.dark.html", scheme: "dark", viewport: "desktop" },
  { file: "welcome.mobile.html", scheme: "light", viewport: "mobile" },
  { file: "welcome.mobile.dark.html", scheme: "dark", viewport: "mobile" },
]);

/** Run the example build so the catalogue documents exist. */
async function buildExample() {
  process.stdout.write(
    "site:stage building the example catalogue, which the home stage renders.\n",
  );
  for (const script of ["build", "example:build"]) {
    await promisify(execFile)("npm", ["run", script], {
      cwd: repository,
      maxBuffer: 32 * 1024 * 1024,
    });
  }
}

/** The manifest entries of the example catalogue, read from its build. */
async function catalogue() {
  const source = await readFile(
    path.join(output, "mokly-manifest.json"),
    "utf8",
  );
  const manifest = /** @type {{ entries?: unknown }} */ (JSON.parse(source));
  if (!Array.isArray(manifest.entries)) {
    throw new Error(
      "The example catalogue manifest has no entries; rebuild it with `npm run example:build`.",
    );
  }
  return /** @type {import("./stage/catalogue.ts").CatalogueEntry[]} */ (
    manifest.entries
  );
}

const sources = DOCUMENTS.map(({ file }) => path.posix.join("screens", file));
if (!sources.every((file) => existsSync(path.join(output, file)))) {
  await buildExample();
}

const documents = new Map();
for (const [index, { file }] of DOCUMENTS.entries()) {
  const source = sources[index] ?? "";
  documents.set(file, {
    html: await readFile(path.join(output, source), "utf8"),
    path: source,
  });
}

const rewritten = rewriteStage(documents);
const entries = await catalogue();
const screen = stagedEntry(entries, SCREEN_ROUTE);
if (screen.title !== rewritten.title) {
  throw new Error(
    `The catalogue names the staged screen ${JSON.stringify(screen.title)} but its document is titled ${JSON.stringify(rewritten.title)}.`,
  );
}
const manifest = parseStageManifest({
  documents: DOCUMENTS.map(({ file, scheme, viewport }) => ({
    file,
    scheme,
    viewport,
  })),
  resources: [...rewritten.resources.keys()].sort(),
  screen: screen.title,
  screenId: rewritten.screenId,
  sections: catalogueSections(entries, screen),
  trail: catalogueTrail(screen),
});

await rm(stage, { force: true, recursive: true });
await mkdir(stage, { recursive: true });
for (const [file, html] of rewritten.documents) {
  await writeFile(path.join(stage, file), html);
}
for (const [file, source] of rewritten.resources) {
  await copyFile(path.join(output, source), path.join(stage, file));
}
await writeFile(
  path.join(stage, "manifest.json"),
  `${JSON.stringify(manifest, undefined, 2)}\n`,
);

process.stdout.write(
  `site:stage published ${manifest.documents.length} ${manifest.screen} documents and ${manifest.resources.length} resources.\n`,
);
