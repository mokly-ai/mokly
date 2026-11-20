import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Route } from "@playwright/test";

import { VIEWER_DIRECTORY } from "@mokly/viewer/data";

import { outputRoot } from "./catalogue-paths";

/**
 * Mokly's frame probe script, which the build injects into every document from
 * the site root (`mokly-published-frame-probe.md`). Opened from disk, that path
 * leaves the output, so the harness serves this one file from the output.
 */
const frameProbe = VIEWER_DIRECTORY + "/client/frame-probe.js";

/** Whether a file lies inside the output. */
function insideOutput(file: string): boolean {
  const local = relative(outputRoot, file);
  return local !== "" && local.split(sep)[0] !== ".." && !isAbsolute(local);
}

/**
 * Answer one request of a document opened from disk: the frame probe from the
 * output, as a server at the output root would; any other file of the output
 * as it is; and nothing outside the output, so that the request fails and the
 * test reports it.
 */
export async function serveOutput(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  if (url.href === pathToFileURL("/" + frameProbe).href)
    return route.fulfill({ path: resolve(outputRoot, frameProbe) });
  if (url.protocol === "file:" && insideOutput(fileURLToPath(url)))
    return route.continue();
  return route.abort("blockedbyclient");
}
