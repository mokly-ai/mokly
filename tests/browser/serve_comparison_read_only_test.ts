import { ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS } from "../helpers/fixture_timing.js";

import { test as base } from "./browser_test.js";
import { serveComparisonCatalogue } from "./serve_comparison_fixture.js";

type WritableCatalogue = Awaited<ReturnType<typeof serveComparisonCatalogue>>;

/**
 * The read-only view of a shared Serve comparison catalogue: no source root,
 * no edit, and no base move, so a test cannot change what the next test of
 * the file reads.
 */
export type ReadOnlyComparisonCatalogue = Readonly<
  Pick<WritableCatalogue, "baseCommit" | "headCommit" | "index" | "url"> & {
    paths: Readonly<WritableCatalogue["paths"]>;
  }
>;

/** The one shared catalogue of the spec file that runs in this worker. */
let shared: { file: string; catalogue: Promise<WritableCatalogue> } | undefined;

/** Close the shared catalogue, when one is open. */
export async function closeReadOnlyCatalogue(): Promise<void> {
  const previous = shared;
  shared = undefined;
  const catalogue = await previous?.catalogue.catch(() => undefined);
  await catalogue?.close();
}

/** The shared catalogue of `file`; a catalogue of another file closes first. */
async function catalogueOf(file: string): Promise<ReadOnlyComparisonCatalogue> {
  let current = shared?.file === file ? shared.catalogue : undefined;
  if (!current) {
    await closeReadOnlyCatalogue();
    const catalogue = serveComparisonCatalogue();
    shared = { file, catalogue };
    // A failed start is not reused; the next test starts again.
    catalogue.catch(() => {
      if (shared?.catalogue === catalogue) shared = undefined;
    });
    current = catalogue;
  }
  const { baseCommit, headCommit, index, paths, url } = await current;
  return Object.freeze({
    baseCommit,
    headCommit,
    index,
    paths: Object.freeze({ ...paths }),
    url,
  });
}

/**
 * The tests of one spec file share one Serve of the default comparison
 * catalogue, and read it only. The first test of the file starts it, and
 * the spec closes it with `test.afterAll(closeReadOnlyCatalogue)`. A failed
 * test ends its worker, which closes the catalogue, so the next test starts
 * a fresh one. Serve keeps its selections and generations between the tests
 * of the file, so a test counts the requests of its own page, never Serve's
 * captures.
 */
export const test = base.extend<{ changes: ReadOnlyComparisonCatalogue }>({
  changes: [
    async ({ browserName }, use, testInfo) => {
      void browserName;
      await use(await catalogueOf(testInfo.file));
    },
    { timeout: ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS },
  ],
  baseURL: async ({ changes }, use) => {
    await use(changes.url);
  },
});
