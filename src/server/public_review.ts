import { createHash } from "node:crypto";
import type { ServerResponse } from "node:http";
import path from "node:path";

import {
  parseReviewResult,
  reviewSnapshotViewPath,
  snapshotSidePath,
  viewRoute,
} from "@mokly/viewer/data";
import type { ReviewResult } from "@mokly/viewer/data";

import { comparisonContentId } from "../export/content_id.js";
import { ownedEntries } from "../export/ownership.js";
import type { SelectedReviewSource } from "../review/selection_types.js";

import { readConfinedFile } from "./confined_file.js";
import { safeDecodePath, send } from "./respond.js";
import type {
  ReviewGeneration,
  ReviewGenerationStore,
} from "./review_generations.js";
import { serveReviewArtifactFile } from "./review_responses.js";

export interface PublicComparison {
  path: string;
  result: ReviewResult;
}

const SNAPSHOT_ROOT = `${path.posix.dirname(snapshotSidePath("before"))}/`;
const AFTER_SNAPSHOT_PREFIX = snapshotSidePath("after");

/** Content-addressed aliases never redirect, render, or initiate a new generation. */
export class PublicReviewAliases {
  private readonly aliases = new Map<string, string>();

  constructor(private readonly generations: ReviewGenerationStore) {}

  async capture(
    generation: ReviewGeneration,
    source: SelectedReviewSource,
  ): Promise<PublicComparison | undefined> {
    const files = new Map<string, Buffer>();
    for (const name of (await ownedEntries(generation.directory)).files) {
      if (name !== "review.json" && !isSnapshotPath(name)) continue;
      const bytes = readConfinedFile(generation.directory, name);
      if (!bytes) return;
      files.set(name, bytes);
    }
    const json = files.get("review.json");
    if (!json) return;
    const result = parseReviewResult(JSON.parse(json.toString("utf8")));
    if (
      result.baseCommit !== source.baseCommit ||
      result.baseRef !== source.baseRef
    )
      return;
    const records = [
      ...result.screens,
      ...result.components.flatMap((component) => component.variants),
    ];
    for (const record of records) {
      if (!record.after) continue;
      for (const view of record.views) {
        if (view.state === "removed") continue;
        const bytes = files.get(reviewSnapshotViewPath("after", record, view));
        if (
          !bytes ||
          createHash("sha256").update(bytes).digest("hex") !==
            source.headDigests[
              viewRoute(record.after.path, view.viewport, view.colorScheme)
            ]
        )
          return;
      }
    }
    for (const [name, bytes] of files) {
      const expected = name.startsWith(AFTER_SNAPSHOT_PREFIX)
        ? source.headDigests[name.slice(AFTER_SNAPSHOT_PREFIX.length)]
        : undefined;
      if (
        expected &&
        createHash("sha256").update(bytes).digest("hex") !== expected
      )
        return;
    }
    for (const [key, version] of this.aliases)
      if (!this.generations.peek(version)) this.aliases.delete(key);
    const identity = comparisonContentId(files);
    this.aliases.set(identity, generation.version);
    return {
      path: `__mokly/diffs/__generations/${identity}/review.json`,
      result,
    };
  }

  handle(url: URL, response: ServerResponse, method: string): boolean {
    const match =
      /^\/__mokly\/diffs\/__generations\/([a-f0-9]{64})\/(.*)$/.exec(
        url.pathname,
      );
    if (!match) return false;
    response.setHeader("cache-control", "no-store");
    const version = this.aliases.get(match[1]!);
    const generation = version ? this.generations.get(version) : undefined;
    const relative = safeDecodePath(match[2]!);
    if (
      !generation ||
      !relative ||
      (relative !== "review.json" && !isSnapshotPath(relative))
    )
      send(response, 404, "text/plain", "Not found", method);
    else
      serveReviewArtifactFile(generation.directory, relative, response, method);
    return true;
  }
}

function isSnapshotPath(value: string): boolean {
  return value.startsWith(SNAPSHOT_ROOT);
}
