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

/** Require a target to stay in the output directory or the served origin. */
export async function assertDesignResource(
  href: string,
  documentUrl: string,
): Promise<void> {
  const url = new URL(href);
  const disk = process.env["MOKLY_PLAYWRIGHT_FILE_DIR"];
  if (disk && new URL(documentUrl).protocol === "file:") {
    if (url.protocol !== "file:")
      throw new Error(`Design resource leaves file output: ${href}`);
    const root = await fs.realpath(path.resolve(disk));
    const target = fileURLToPath(url);
    const inside = (value: string) => {
      const relative = path.relative(root, value);
      return (
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
      );
    };
    if (!inside(target))
      throw new Error(`Design resource leaves file output: ${href}`);
    try {
      if (!inside(await fs.realpath(target)))
        throw new Error(`Design resource leaves file output: ${href}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  } else if (url.origin !== new URL(documentUrl).origin) {
    throw new Error(`Design resource leaves catalogue origin: ${href}`);
  }
}

/** Static output publishes an inspector; Serve design documents have no script. */
export function unexpectedDesignScripts(): string {
  return process.env["MOKLY_PLAYWRIGHT_STATIC_DIR"] ||
    process.env["MOKLY_PLAYWRIGHT_FILE_DIR"]
    ? 'script:not([src="/mokly-viewer/client/inspector.js"])'
    : "script";
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
    try {
      return (await fs.stat(fileURLToPath(url))).isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  return (await request.get(href)).ok();
}
