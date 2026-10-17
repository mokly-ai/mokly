import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

/** Copy a build, remove its source workspace, then serve only the copied bytes. */
export async function copiedHost(
  prefix: string,
  prepare: (source: string, output: string) => Promise<void>,
  signal?: AbortSignal,
) {
  const workspace = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      prefix,
    ),
  );
  const source = path.join(workspace, "source");
  const built = path.join(source, ".context/built");
  const directory = path.join(workspace, "isolated");
  let host: Awaited<ReturnType<typeof serveStaticFiles>> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      await host?.close();
      await fs.rm(workspace, { recursive: true, force: true });
    })());
  try {
    await fs.mkdir(source);
    signal?.throwIfAborted();
    await prepare(source, built);
    signal?.throwIfAborted();
    await fs.cp(built, directory, { recursive: true });
    await fs.rm(source, { recursive: true });
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
