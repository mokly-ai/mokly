import { test as base } from "./browser_test.js";

export { comparisonPaths } from "../helpers/comparison_catalogue.js";

/** The immutable native Changes copy shared by every worker in one suite. */
export function copiedComparisonUrl(): string {
  const url = process.env["MOKLY_PLAYWRIGHT_COMPARISON_URL"];
  if (!url) throw new Error("Copied comparison catalogue is not ready");
  return url;
}

/** Use this root for byte assertions; tests must not mutate shared output. */
export function copiedComparisonDirectory(): string {
  const directory = process.env["MOKLY_PLAYWRIGHT_COMPARISON_DIR"];
  if (!directory) throw new Error("Copied comparison output is not ready");
  return directory;
}

/** A standalone shell over real immutable comparison output; no Serve endpoint. */
export const test = base.extend({
  baseURL: async ({ browserName }, use) => {
    void browserName;
    await use(copiedComparisonUrl());
  },
});
