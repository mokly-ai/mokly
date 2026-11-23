/**
 * An embedded `MoklyViewer` that fills the Changes tab's `changesStart` slot,
 * over a copy of the shared comparison output. The helper copies the output
 * into its own directory, adds the host page of `changes_slot_entry.tsx`, and
 * serves that directory on one origin, so the viewer, its frames and the
 * host's links share it. `/viewer.html?entry={path}` mounts the viewer, and
 * `slot=link&link={address}` or `slot=empty` fills the slot, as
 * `changes_slot_entry.tsx` says. The source copy's bytes stay unchanged.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { repositoryRoot } from "../helpers/fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { copiedComparisonDirectory } from "./comparison_test.js";

/** The origin of the host page, and how to stop serving it. */
export interface ChangesSlotHost {
  url: string;
  close(): Promise<void>;
}

/** Copy the comparison output, add the host page, and serve it. */
export async function changesSlotHost(): Promise<ChangesSlotHost> {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "changes-slot-",
    ),
  );
  let server: Awaited<ReturnType<typeof serveStaticFiles>> | undefined;
  const close = async () => {
    await server?.close();
    await fs.rm(root, { recursive: true, force: true });
  };
  try {
    await fs.cp(copiedComparisonDirectory(), root, { recursive: true });
    await build({
      entryPoints: [
        path.join(repositoryRoot, "tests/browser/changes_slot_entry.tsx"),
      ],
      outfile: path.join(root, "viewer.js"),
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2023",
      logLevel: "silent",
    });
    await fs.copyFile(
      path.join(repositoryRoot, "packages/viewer/dist/styles.css"),
      path.join(root, "viewer.css"),
    );
    await fs.cp(
      path.join(repositoryRoot, "packages/viewer/dist/assets"),
      path.join(root, "assets"),
      { recursive: true },
    );
    await fs.writeFile(
      path.join(root, "viewer.html"),
      '<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/viewer.css"><body><script type="module" src="/viewer.js"></script></body>',
    );
    server = await serveStaticFiles(root);
    return { url: server.url, close };
  } catch (error) {
    await close();
    throw error;
  }
}
