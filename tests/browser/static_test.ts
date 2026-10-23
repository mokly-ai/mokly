import path from "node:path";

import { repositoryRoot } from "../helpers/fixture.js";

import { test as base } from "./browser_test.js";

export function copiedStaticUrl(): string {
  const url = process.env["MOKLY_PLAYWRIGHT_COPIED_URL"];
  if (!url) throw new Error("Copied static catalogue is not ready");
  return url;
}
export function copiedStaticDirectory(): string {
  const directory = process.env["MOKLY_PLAYWRIGHT_COPIED_DIR"];
  if (!directory)
    throw new Error("Copied static output directory is not ready");
  return directory;
}
export function copiedDesignFileUrl(file: string): URL {
  const root = path.join(repositoryRoot, "examples/basic/mokly-generated");
  const route = path.relative(root, file).split(path.sep).join("/");
  if (route.startsWith("../") || path.isAbsolute(route))
    throw new Error("Design is outside the catalogue");
  return new URL(`/static/mokly-generated/${route}`, copiedStaticUrl());
}
/** Resolve the suite's copied output after global setup, including hook requests. */
export const test = base.extend({
  baseURL: async ({ browserName }, use) => {
    void browserName;
    await use(copiedStaticUrl());
  },
});
