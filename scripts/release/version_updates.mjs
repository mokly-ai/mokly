/** Exercise the pinned Release Please implementation against local source. */
import fs from "node:fs/promises";
import path from "node:path";

import { Manifest, setLogger } from "release-please";

const MANIFEST = ".release-please-manifest.json";

/**
 * Compute the updates of one breaking release from `root`. A `fixedManifest`
 * replaces the release manifest everywhere Release Please reads it, including
 * the previous release tags derived from it.
 */
export async function releaseUpdates(root, changedFiles, fixedManifest) {
  const read = async (file) =>
    file === MANIFEST && fixedManifest
      ? `${JSON.stringify(fixedManifest, null, 2)}\n`
      : await fs.readFile(path.join(root, file), "utf8");
  const versions = JSON.parse(await read(MANIFEST));
  const config = JSON.parse(await read("release-please-config.json"));
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
      for (const [component, version] of Object.entries(versions)) {
        const entry = config.packages[component];
        const tagName = `${entry["include-component-in-tag"] ? entry.component + "-" : ""}v${version}`;
        yield { name: tagName, tagName, sha: previous, notes: "" };
      }
    },
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
