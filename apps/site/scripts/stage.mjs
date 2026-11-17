/** Publish one path-addressed dogfood screen and its resources for the home stage. */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { readCatalogueIndex } from "@mokly/viewer";
import { currentDocumentPath, viewRoute } from "@mokly/viewer/data";

import { STAGE_DIRECTORY, parseStageManifest } from "../src/stage.ts";
import { repositoryPath } from "../src/workspace.ts";

import {
  catalogueSections,
  catalogueTrail,
  stagedEntry,
} from "./stage/catalogue.ts";
import { rewriteStage, stylesheetResources } from "./stage/fragments.ts";

const repository = repositoryPath();
const output = path.join(repository, "mokly-static");
const stage = STAGE_DIRECTORY;

/** The catalogue path of the screen the stage shows. */
const SCREEN_PATH = "product/account/project-created";

/** Every document of that screen, by the file name the site publishes. */
const DOCUMENTS = /** @type {const} */ ([
  {
    file: "project-created.desktop.html",
    scheme: "light",
    viewport: "desktop",
  },
  {
    file: "project-created.desktop.dark.html",
    scheme: "dark",
    viewport: "desktop",
  },
  {
    file: "project-created.mobile.html",
    scheme: "light",
    viewport: "mobile",
  },
  {
    file: "project-created.mobile.dark.html",
    scheme: "dark",
    viewport: "mobile",
  },
]);

/** Run the example build so the catalogue documents exist. */
async function buildMockups() {
  process.stdout.write(
    "site:stage building the dogfood catalogue, which the home stage renders.\n",
  );
  await promisify(execFile)(
    "npm",
    ["run", "mockups:build", "--workspace", "@mokly-cloud/mockups"],
    { cwd: path.join(repository, "ts"), maxBuffer: 32 * 1024 * 1024 },
  );
}

/** Read the catalogue and collect the records used by the home stage. */
async function catalogue() {
  try {
    const source = await readFile(
      path.join(output, "mokly-viewer", "index.json"),
      "utf8",
    );
    const index = readCatalogueIndex(JSON.parse(source));
    const entries = [
      ...index.screens,
      ...index.components,
      ...index.pages,
      ...index.documents,
      ...index.useCases,
    ];
    return { index, entries };
  } catch (error) {
    throw new Error(
      "The dogfood catalogue needs a version 9 catalogue index. Run npm run mockups:build from the repository root.",
      { cause: error },
    );
  }
}

/**
 * The generated document of one viewport and scheme, per Mokly's
 * documented artifact paths below `static/mokly-generated/`.
 */
function screenDocument(
  /** @type {"mobile" | "desktop"} */ viewport,
  /** @type {"light" | "dark"} */ scheme,
) {
  return currentDocumentPath(viewRoute(SCREEN_PATH, viewport, scheme));
}

const sources = DOCUMENTS.map(({ scheme, viewport }) =>
  screenDocument(viewport, scheme),
);
// A missing selected document, including a missing output tree, triggers one
// mockups build. Documents that exist are read as they are, stale or not.
if (!sources.every((file) => existsSync(path.join(output, file)))) {
  await buildMockups();
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
const { index, entries } = await catalogue();
const screen = stagedEntry(entries, SCREEN_PATH);
if (screen.title !== rewritten.title) {
  throw new Error(
    `The catalogue names the staged screen ${JSON.stringify(screen.title)} but its document is titled ${JSON.stringify(rewritten.title)}.`,
  );
}
const resources = new Map(rewritten.resources);
for (const [file, source] of resources) {
  if (!file.endsWith(".css")) continue;
  const css = await readFile(path.join(output, source), "utf8");
  for (const dependency of stylesheetResources(source, css)) {
    resources.set(dependency, dependency);
  }
}
const manifest = parseStageManifest({
  documents: DOCUMENTS.map(({ file, scheme, viewport }) => ({
    file,
    scheme,
    viewport,
  })),
  resources: [...resources.keys()].sort(),
  screen: screen.title,
  screenPath: screen.path,
  sections: catalogueSections(entries, index, screen),
  trail: catalogueTrail(entries, index, screen),
});

await rm(stage, { force: true, recursive: true });
await mkdir(stage, { recursive: true });
for (const [file, html] of rewritten.documents) {
  await writeFile(path.join(stage, file), html);
}
for (const [file, source] of resources) {
  await mkdir(path.dirname(path.join(stage, file)), { recursive: true });
  await copyFile(path.join(output, source), path.join(stage, file));
}
await writeFile(
  path.join(stage, "manifest.json"),
  `${JSON.stringify(manifest, undefined, 2)}\n`,
);

process.stdout.write(
  `site:stage published ${manifest.documents.length} ${manifest.screen} documents and ${manifest.resources.length} resources.\n`,
);
