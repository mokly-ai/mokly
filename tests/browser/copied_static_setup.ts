import fs from "node:fs/promises";
import path from "node:path";

import { buildStaticCatalogue } from "../helpers/build_site.js";
import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

/** Each suite owns a fresh build. Only its copied output reaches the file host. */
export async function startCopiedStaticHost(signal?: AbortSignal) {
  const workspace = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "copied-static-",
    ),
  );
  const built = path.join(workspace, "built");
  const directory = path.join(workspace, "isolated");
  let host: Awaited<ReturnType<typeof serveStaticFiles>> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      await host?.close();
      await fs.rm(workspace, { recursive: true, force: true });
    })());
  try {
    const supplied =
      process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"] ??
      process.env["MOKLY_PLAYWRIGHT_FILE_DIR"];
    if (supplied)
      await fs.cp(path.resolve(supplied), built, { recursive: true });
    else
      await buildStaticCatalogue(
        path.join(repositoryRoot, "examples/basic"),
        built,
        signal,
      );
    signal?.throwIfAborted();
    await fs.cp(built, directory, { recursive: true });
    await fs.rm(built, { recursive: true });
    signal?.throwIfAborted();
    host = await serveStaticFiles(directory);
    return { directory, url: host.url, close };
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Static setup and cleanup failed",
        { cause: cleanup },
      );
    }
    throw error;
  }
}
