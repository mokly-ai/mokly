/** Serve viewer test inputs without a backend compiler or CLI. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { serveStaticFiles } from "../../../tests/helpers/static_server.js";

import { rawDetailFixtures, rawIndexFixture } from "./catalogue_v7_fixture.js";

export async function crossOriginFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-viewer-"));
  const index = rawIndexFixture();
  const details = rawDetailFixtures();
  const host = await serveStaticFiles(root);
  const frames = await serveStaticFiles(root, { allowedOrigin: host.url });
  return {
    root,
    index,
    details,
    host,
    frames,
    async close() {
      await Promise.all([host.close(), frames.close()]);
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
