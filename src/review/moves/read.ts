import {
  isManifestComponentVariant,
  type ManifestEntry,
} from "@mokly/viewer/data";

import { MoklyError } from "../../errors.js";
import type { ReviewAssetReader } from "../assets.js";

import { contentMoveSignals, moveDocuments } from "./content.js";
import type { MarkdownMoveSources } from "./markdown_sources.js";
import { pairMoves } from "./pair.js";
import type { MoveResources } from "./resources.js";
import { moveIdentity, type MovePairing } from "./types.js";

/** Read candidate material once; matching itself remains a pure injected policy. */
export async function readMovePairing(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  beforeReader: ReviewAssetReader,
  afterReader: ReviewAssetReader,
  markdown?: MarkdownMoveSources,
  resources?: MoveResources,
): Promise<MovePairing> {
  const baseIds = new Set(before.map(moveIdentity));
  const headIds = new Set(after.map(moveIdentity));
  const bases = before.filter((entry) => !headIds.has(moveIdentity(entry)));
  const heads = after.filter((entry) => !baseIds.has(moveIdentity(entry)));
  const [baseDocuments, headDocuments] =
    bases.length && heads.length
      ? await Promise.all([
          readDocuments(bases, before, beforeReader),
          readDocuments(heads, after, afterReader),
        ])
      : [new Map<string, string>(), new Map<string, string>()];
  return pairMoves(
    before,
    after,
    contentMoveSignals(
      before,
      after,
      baseDocuments,
      headDocuments,
      markdown,
      resources,
    ),
  );
}

async function readDocuments(
  entries: readonly ManifestEntry[],
  catalogue: readonly ManifestEntry[],
  reader: ReviewAssetReader,
): Promise<ReadonlyMap<string, string>> {
  const parents = new Set(
    entries
      .filter(
        (entry) =>
          entry.kind === "component" && !isManifestComponentVariant(entry),
      )
      .map((entry) => entry.path),
  );
  const variants = catalogue.filter(
    (entry) =>
      entry.kind === "component" &&
      isManifestComponentVariant(entry) &&
      parents.has(entry.variantOf),
  );
  const routes = [
    ...new Set(
      [...entries, ...variants].flatMap((entry) =>
        moveDocuments(entry).map((view) => view.route),
      ),
    ),
  ];
  if (!routes.length) return new Map();
  const loaded = reader.readMany
    ? await reader.readMany(routes)
    : new Map(
        await Promise.all(
          routes.map(
            async (route) => [route, await reader.read(route)] as const,
          ),
        ),
      );
  return new Map(
    routes.map((route) => {
      const content = loaded.get(route);
      if (content === undefined)
        throw new MoklyError(
          "review-invalid",
          `Move comparison document is missing: ${route}`,
        );
      return [route, Buffer.from(content).toString("utf8")];
    }),
  );
}
