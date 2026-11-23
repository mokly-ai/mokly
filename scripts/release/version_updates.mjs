/** Exercise the pinned Release Please implementation against local source. */
import fs from "node:fs/promises";
import path from "node:path";

import { Manifest, setLogger } from "release-please";

const MANIFEST = ".release-please-manifest.json";
const CONFIG = "release-please-config.json";

/**
 * Compute the updates of one breaking release from `root`. `versions` replaces
 * the release manifest everywhere Release Please reads it, including the
 * previous release tags derived from it. A caller always names the versions,
 * so a test never depends on the live manifest by accident. `paths` keeps only
 * those release components, so a test can follow one product.
 */
export async function releaseUpdates(root, changedFiles, versions, paths) {
  const only = (entries) =>
    paths
      ? Object.fromEntries(
          Object.entries(entries).filter(([key]) => paths.includes(key)),
        )
      : entries;
  const source = async (file) =>
    file === MANIFEST
      ? `${JSON.stringify(versions, null, 2)}\n`
      : await fs.readFile(path.join(root, file), "utf8");
  const read = async (file) => {
    const content = await source(file);
    if (file === MANIFEST)
      return `${JSON.stringify(only(JSON.parse(content)), null, 2)}\n`;
    if (file !== CONFIG) return content;
    const config = JSON.parse(content);
    return `${JSON.stringify({ ...config, packages: only(config.packages) })}\n`;
  };
  const released = JSON.parse(await read(MANIFEST));
  const config = JSON.parse(await read(CONFIG));
  const previous = "a".repeat(40);
  const github = {
    repository: { owner: "mokly-ai", repo: "mokly", defaultBranch: "main" },
    getFileJson: async (file) => JSON.parse(await read(file)),
    getFileContentsOnBranch: async (file) => {
      const parsedContent = await read(file);
      return {
        parsedContent,
        content: Buffer.from(parsedContent).toString("base64"),
        sha: previous,
      };
    },
    async *releaseIterator() {
      for (const [component, version] of Object.entries(released)) {
        const entry = config.packages[component];
        // A manifest entry without a component, or a component that never
        // released, has no release tag.
        if (!entry || version === "0.0.0") continue;
        const tagName = `${entry["include-component-in-tag"] ? entry.component + "-" : ""}v${version}`;
        yield { name: tagName, tagName, sha: previous, notes: "" };
      }
    },
    // A component without a release looks for its tag; the fixture has none.
    async *tagIterator() {},
    async *mergeCommitIterator() {
      yield {
        sha: "b".repeat(40),
        message:
          "feat!: release fixture\n\nBREAKING CHANGE: test a coordinated version bump.",
        files: changedFiles,
      };
      yield { sha: previous, message: "chore: prior release", files: [] };
    },
  };
  const logger = Object.fromEntries(
    ["info", "warn", "error", "debug", "trace"].map((level) => [
      level,
      () => undefined,
    ]),
  );
  setLogger(logger);
  const manifest = await Manifest.fromManifest(
    github,
    "main",
    undefined,
    undefined,
    { logger },
  );
  const requests = await manifest.buildPullRequests();
  const contents = new Map();
  for (const request of requests) {
    for (const update of request.updates) {
      let previous = contents.get(update.path);
      if (previous === undefined) {
        try {
          previous = await read(update.path);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          if (!update.createIfMissing) continue;
          previous = "";
        }
      }
      contents.set(update.path, update.updater.updateContent(previous, logger));
    }
  }
  return contents;
}
