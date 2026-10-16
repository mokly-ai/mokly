import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { APIRequestContext } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

import { ownExampleServerUrl } from "./example_servers.js";

/** Map an authored design's document path to the worker's Serve origin. */
export function designFileUrl(file: string): URL {
  const root = path.join(repositoryRoot, "examples/basic/mokly-generated");
  const route = path.relative(root, file).split(path.sep).join("/");
  if (route.startsWith("../") || path.isAbsolute(route))
    throw new Error("Design document is outside the catalogue");
  const disk = process.env["MOKLY_PLAYWRIGHT_FILE_DIR"];
  if (disk)
    return pathToFileURL(
      path.join(path.resolve(disk), "static/mokly-generated", route),
    );
  const origin = ownExampleServerUrl();
  if (!origin) throw new Error("The browser example server is not ready");
  return new URL(`/static/mokly-generated/${route}`, origin);
}

/** Check portable resource targets through their actual delivery mode. */
export async function designResourceExists(
  request: APIRequestContext,
  href: string,
): Promise<boolean> {
  const url = new URL(href);
  if (url.protocol === "file:") {
    url.hash = "";
    url.search = "";
    return (await fs.stat(fileURLToPath(url))).isFile();
  }
  return (await request.get(href)).ok();
}
