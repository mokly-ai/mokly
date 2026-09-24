import fs from "node:fs";
import path from "node:path";

/** Repository root containing the package under test. */
export const repositoryRoot = path.resolve(import.meta.dirname, "../..");

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
  entriesDir: "entries",
  mockupsDir: "mockups",
  repoRoot: ".",
${options?.extraConfig ? `  ${options.extraConfig}\n` : ""}  review: { outDir: ".review" }
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
  route: string,
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
    `\nimport { definePage as definePage_${suffix} } from "@mokly/mokly";\nimport { ${exportName} as render_${suffix} } from ${JSON.stringify(imported.startsWith(".") ? imported : `./${imported}`)};\nmockups.push(definePage_${suffix}({ id: ${JSON.stringify(id)}, route: ${JSON.stringify(route)}, title: ${JSON.stringify(id)}, description: "Complete fixture document", relatedDocs: [], render: render_${suffix} }));\n`,
  );
}

/** Valid two-screen catalogue with reciprocal use-case membership. */
export function validEntrySource(
  options: { body?: string; firstTitle?: string } = {},
): string {
  return fixtureEntrySource(
    `defineCollection({ ...metadata, childIds: ["home", "details", "tour"], description: "Fixture collection", id: "fixture", title: "Fixture" })`,
    options,
  );
}

/** Valid watched fixture whose Home screen can move between two collections. */
export function reparentedEntrySource(
  homeParent: "archive" | "screens",
  options: {
    archiveTitle?: string;
    body?: string;
    firstTitle?: string;
    screensTitle?: string;
  } = {},
): string {
  const screenChildren =
    homeParent === "screens" ? '["home", "details"]' : '["details"]';
  const archiveChildren =
    homeParent === "archive" ? '["tour", "home"]' : '["tour"]';
  const screensTitle = JSON.stringify(options.screensTitle ?? "Screens");
  const archiveTitle = JSON.stringify(options.archiveTitle ?? "Archive");
  return fixtureEntrySource(
    `defineCollection({ ...metadata, childIds: ["screens", "archive"], description: "Fixture root", id: "fixture", title: "Fixture" }),
  defineCollection({ ...metadata, childIds: ${screenChildren}, description: "Fixture screens", id: "screens", title: ${screensTitle} }),
  defineCollection({ ...metadata, childIds: ${archiveChildren}, description: "Fixture archive", id: "archive", title: ${archiveTitle} })`,
    options,
  );
}

function fixtureEntrySource(
  collections: string,
  options: { body?: string; firstTitle?: string },
): string {
  const body = options.body ?? `<a href="mock:details">Details</a>`;
  const firstTitle = options.firstTitle ?? "Home";
  return `import { defineCollection, defineScreen, defineUseCase } from "@mokly/mokly";
import React from "react";
const metadata = { relatedDocs: ["notes.md"] };
export const mockups = [
  ${collections},
  defineScreen({ ...metadata, description: "Home screen", desktop: <main id="home">${body}</main>, id: "home", mobile: <main id="home-mobile">${body}</main>, route: "screens/home.html", title: ${JSON.stringify(firstTitle)}, useCaseIds: ["tour"] }),
  defineScreen({ ...metadata, description: "Detail screen", desktop: <main id="details">Detail</main>, id: "details", mobile: <main id="details-mobile">Detail</main>, route: "screens/details.html", title: "Details", useCaseIds: ["tour"] }),
  defineUseCase({ ...metadata, description: "Fixture journey", id: "tour", route: "user-flows/tour.html", steps: [{ screenId: "home" }, { screenId: "details" }], title: "Tour" })
];
`;
}
