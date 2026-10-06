import fs from "node:fs";
import path from "node:path";

/** Repository root containing the package under test. */
export const repositoryRoot = path.resolve(import.meta.dirname, "../..");

/** Directory of the CLI package under test. */
export const packageRoot = path.join(repositoryRoot, "packages/mokly");

/** Built CLI executable for process and archive tests. */
export const cliBinPath = path.join(packageRoot, "dist/cli/bin.js");

/** Dependent resource that must close before a fixture workspace is removed. */
export type FixtureCleanup = () => Promise<void> | void;

/** One isolated consumer repository under the ignored test context. */
export interface TestFixture {
  /** Register dependent cleanup in last-created, first-closed order. */
  beforeRemove(cleanup: FixtureCleanup): void;
  configPath: string;
  entriesDir: string;
  entryPath: string;
  mockupsDir: string;
  /** Drain registered dependents once, then remove the workspace. */
  remove(): Promise<void>;
  root: string;
}

/** Create a clean synthetic consumer that resolves package peers from this repo. */
export async function createFixture(
  entrySource = validEntrySource(),
  options?: { extraConfig?: string },
): Promise<TestFixture> {
  const contextRoot = path.join(repositoryRoot, ".context");
  await fs.promises.mkdir(contextRoot, { recursive: true });
  const root = await fs.promises.mkdtemp(path.join(contextRoot, "mokly-test-"));
  const entriesDir = path.join(root, "entries");
  const mockupsDir = path.join(root, "mockups");
  await fs.promises.mkdir(entriesDir, { recursive: true });
  await fs.promises.mkdir(mockupsDir, { recursive: true });
  await fs.promises.writeFile(path.join(root, "notes.md"), "# Fixture notes\n");
  const entryPath = path.join(entriesDir, "fixture.mockup.tsx");
  await fs.promises.writeFile(entryPath, entrySource);
  const configPath = path.join(root, "mokly.config.ts");
  await fs.promises.writeFile(
    configPath,
    `import { defineConfig } from "@mokly/mokly";
export default defineConfig({
  generatedOutput: "committed",
  roots: [{ dir: "entries" }],
  mockupsDir: "mockups",
  repoRoot: ".",
${options?.extraConfig ? `  ${options.extraConfig}\n` : ""}  review: { outDir: ".review", sharedImpact: ["notes.md"] }
});
`,
  );
  const cleanups: FixtureCleanup[] = [];
  let removal: Promise<void> | undefined;
  return {
    beforeRemove(cleanup) {
      if (removal)
        throw new Error("cannot register cleanup after fixture removal starts");
      cleanups.push(cleanup);
    },
    configPath,
    entriesDir,
    entryPath,
    mockupsDir,
    remove() {
      removal ??= removeOwnedFixture(root, cleanups);
      return removal;
    },
    root,
  };
}

/** Remove a synthetic consumer after a test. */
export function removeFixture(fixture: TestFixture): Promise<void> {
  return fixture.remove();
}

async function removeOwnedFixture(
  root: string,
  cleanups: readonly FixtureCleanup[],
): Promise<void> {
  const failures: unknown[] = [];
  for (const cleanup of [...cleanups].reverse()) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "fixture dependent cleanup failed");
  await fs.promises.rm(root, { force: true, recursive: true });
}

/** Explicitly register an imported complete-document helper in a test consumer. */
export async function registerFixturePage(
  fixture: TestFixture,
  id: string,
  _route: string,
  modulePath: string,
  exportName = "source",
): Promise<void> {
  const suffix = id.replaceAll("-", "_");
  const imported = path
    .relative(fixture.entriesDir, path.resolve(fixture.root, modulePath))
    .split(path.sep)
    .join("/");
  await fs.promises.appendFile(
    fixture.entryPath,
    `\nimport { definePage as definePage_${suffix} } from "@mokly/mokly";\nimport { ${exportName} as render_${suffix} } from ${JSON.stringify(imported.startsWith(".") ? imported : `./${imported}`)};\nmockups.push(definePage_${suffix}({ path: ${JSON.stringify(id)}, title: ${JSON.stringify(id)}, description: "Complete fixture document", dependencies: [], relatedDocs: [], render: render_${suffix} }));\n`,
  );
}

/** Valid two-screen catalogue with reciprocal use-case membership. */
export function validEntrySource(
  options: { body?: string; firstTitle?: string } = {},
): string {
  return fixtureEntrySource(
    { home: "home", details: "details", tour: "tour" },
    [],
    options,
  );
}

/** A watched path tree with explicit folder titles and movable screen files. */
export function reparentedEntrySource(
  homeParent: "archive" | "screens",
  options: {
    archiveTitle?: string;
    body?: string;
    firstTitle?: string;
    screensTitle?: string;
    /** Slug of the screens folder; changing it moves that folder's path. */
    screensSlug?: string;
    sharedChildTitle?: string;
  } = {},
): string {
  const child = options.sharedChildTitle ? "/states" : "";
  const screens = `fixture/${options.screensSlug ?? "screens"}`;
  const folders = [
    { path: "fixture", title: "Fixture" },
    { path: "fixture/archive", title: options.archiveTitle ?? "Archive" },
    { path: screens, title: options.screensTitle ?? "Screens" },
    ...(options.sharedChildTitle
      ? [
          { path: "fixture/archive/states", title: options.sharedChildTitle },
          { path: `${screens}/states`, title: options.sharedChildTitle },
        ]
      : []),
  ];
  return fixtureEntrySource(
    {
      home: `${homeParent === "screens" ? screens : "fixture/archive"}${child}/home`,
      details: `${screens}${child}/details`,
      tour: `fixture/archive${child}/tour`,
    },
    folders,
    options,
  );
}

function fixtureEntrySource(
  addresses: { home: string; details: string; tour: string },
  folders: readonly { path: string; title: string }[],
  options: { body?: string; firstTitle?: string },
): string {
  const body =
    options.body ?? `<a href="mock:${addresses.details}">Details</a>`;
  const firstTitle = options.firstTitle ?? "Home";
  return `import { defineScreen, defineUseCase${folders.length ? ", defineFolder" : ""} } from "@mokly/mokly";
import React from "react";
const metadata = { dependencies: ["notes.md"], relatedDocs: ["notes.md"] };
export const mockups = [
  defineScreen({ ...metadata, description: "Home screen", desktop: <main id="home">${body}</main>, path: "${addresses.home}", mobile: <main id="home-mobile">${body}</main>, title: ${JSON.stringify(firstTitle)}, useCasePaths: ["${addresses.tour}"] }),
  defineScreen({ ...metadata, description: "Detail screen", desktop: <main id="details">Detail</main>, path: "${addresses.details}", mobile: <main id="details-mobile">Detail</main>, title: "Details", useCasePaths: ["${addresses.tour}"] }),
  defineUseCase({ ...metadata, description: "Fixture journey", path: "${addresses.tour}", steps: [{ screenPath: "${addresses.home}" }, { screenPath: "${addresses.details}" }], title: "Tour" }),
  ${folders.length ? `...${JSON.stringify(folders)}.map((record) => defineFolder(record)),` : ""}
];
`;
}
