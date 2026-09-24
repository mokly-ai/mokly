import { createHash } from "node:crypto";
import type { ServerResponse } from "node:http";

import { generatedViews, parseReviewResult } from "@mokly/viewer/data";
import type { ReviewResult } from "@mokly/viewer/data";

import { comparisonContentId } from "../export/content_id.js";
import { ownedEntries } from "../export/ownership.js";
import { generatedManifestRoutes } from "../registry/generated_routes.js";
import { rebaseGeneratedSnapshotUrls } from "../review/normalize_urls.js";
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
      if (name !== "review.json" && !name.startsWith("snapshots/")) continue;
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
    const headOutputs = new Map(source.headOutputs ?? []);
    const generatedRoutes = generatedManifestRoutes(source.after);
    const expectedDigest = (route: string): string | undefined => {
      const digest = source.headDigests[route];
      if (!digest) return;
      if (source.after.schemaVersion !== 6 || !generatedRoutes.has(route))
        return digest;
      const raw = headOutputs.get(route);
      if (!raw || createHash("sha256").update(raw).digest("hex") !== digest)
        return;
      return createHash("sha256")
        .update(
          rebaseGeneratedSnapshotUrls(
            raw,
            route,
            ".generated",
            generatedRoutes,
          ),
        )
        .digest("hex");
    };
    for (const view of source.after.entries.flatMap(generatedViews)) {
      const bytes = files.get(`snapshots/after/${view.path}`);
      if (
        !bytes ||
        createHash("sha256").update(bytes).digest("hex") !==
          expectedDigest(view.path)
      )
        return;
    }
    for (const [name, bytes] of files) {
      const expected = name.startsWith("snapshots/after/")
        ? expectedDigest(name.slice(16))
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
      (relative !== "review.json" && !relative.startsWith("snapshots/"))
    )
      send(response, 404, "text/plain", "Not found", method);
    else
      serveReviewArtifactFile(generation.directory, relative, response, method);
    return true;
  }
}
