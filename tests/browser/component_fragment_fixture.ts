import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { readCatalogueIndex } from "@mokly/viewer";

import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { writeBrowserFile } from "../../packages/viewer/tests/browser_documents.js";
import { buildStaticCatalogue } from "../helpers/build_site.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { serveCatalogue } from "./catalogue_fixture.js";

/** Deliver the private slot fixture through Serve, static HTTP, or disk. */
export async function componentFragmentFixture(files: Record<string, string>) {
  const config = { colorSchemes: ["light", "dark"] };
  const disk = Boolean(process.env["MOKLY_PLAYWRIGHT_FILE_DIR"]);
  if (!disk && !process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"]) {
    const fixture = await serveCatalogue(files, config);
    const response = await fetch(`${fixture.url}/mokly-viewer/index.json`);
    return { ...fixture, index: readCatalogueIndex(await response.json()) };
  }
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "component-fragments-",
    ),
  );
  let host: Awaited<ReturnType<typeof serveStaticFiles>> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      await host?.close();
      await fs.rm(root, { recursive: true, force: true });
    })());
  ownBrowserCleanup(close);
  const source = path.join(root, "source");
  const output = path.join(root, "site");
  try {
    await writeBrowserFile(
      source,
      "mokly.config.json",
      JSON.stringify({
        repoRoot: ".",
        roots: [{ dir: "specs" }],
        ...config,
      }),
    );
    for (const [name, contents] of Object.entries(files))
      await writeBrowserFile(source, name, contents);
    await fs.symlink(
      path.join(repositoryRoot, "node_modules"),
      path.join(source, "node_modules"),
      "junction",
    );
    const built = path.join(source, "built");
    await buildStaticCatalogue(source, built);
    await fs.cp(built, output, { recursive: true });
    await fs.rm(source, { recursive: true, force: true });
    const index = readCatalogueIndex(
      JSON.parse(
        await fs.readFile(path.join(output, "mokly-viewer/index.json"), "utf8"),
      ),
    );
    if (!disk) host = await serveStaticFiles(output);
    return { url: host?.url ?? pathToFileURL(output).href, index, close };
  } catch (error) {
    await close();
    throw error;
  }
}
