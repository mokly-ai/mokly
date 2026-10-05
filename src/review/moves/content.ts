import {
  canonicalJson,
  documentRoute,
  generatedViews,
  generatedResourcePath,
  isManifestComponentVariant,
  type ManifestEntry,
  type GeneratedComponentView,
} from "@mokly/viewer/data";

import {
  componentUsageSignals,
  stripMarkers,
} from "../../components/comparison_material.js";
import { MoklyError } from "../../errors.js";
import { normalizeReviewPair } from "../ignore.js";

import { contentFingerprint } from "./content_fingerprint.js";
import { baselinePathMapper } from "./identity.js";
import { catalogueLinkNormalizer } from "./links.js";
import type { MarkdownMoveSources } from "./markdown_sources.js";
import type { MoveResources } from "./resources.js";
import { documentSimilarity } from "./similarity.js";
import {
  moveIdentity,
  type EntryMove,
  type MoveCandidate,
  type MoveSignals,
} from "./types.js";
import { visiblePageText } from "./visible_text.js";

/** One complete rendered document and its optional component ownership evidence. */
export interface MoveDocument {
  key: string;
  route: string;
  usage?: GeneratedComponentView["usage"];
}

/** Enumerate the exact scheme/view set used by the content signal. */
export function moveDocuments(entry: ManifestEntry): readonly MoveDocument[] {
  if (entry.kind === "page" || entry.kind === "document")
    return (
      entry.kind === "document" ? entry.colorSchemes : (["light"] as const)
    ).map((scheme) => ({
      key: scheme,
      route: generatedResourcePath(documentRoute(entry.path, scheme)),
    }));
  return generatedViews(entry).map((view) => ({
    key: `${view.viewport}:${view.colorScheme}`,
    route: generatedResourcePath(view.path),
    ...(view.usage ? { usage: view.usage } : {}),
  }));
}

/** Bind immutable documents to pure signals; both reuse material/ignore normalization. */
export function contentMoveSignals(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  baseDocuments: ReadonlyMap<string, string>,
  headDocuments: ReadonlyMap<string, string>,
  markdown?: MarkdownMoveSources,
  resources?: MoveResources,
): MoveSignals {
  const bases = new Map(before.map((entry) => [moveIdentity(entry), entry]));
  const heads = new Map(after.map((entry) => [moveIdentity(entry), entry]));
  const entries = (base: MoveCandidate, head: MoveCandidate) => ({
    base: bases.get(moveIdentity(base))!,
    head: heads.get(moveIdentity(head))!,
  });
  let scope:
    | {
        moves: readonly EntryMove[];
        count: number;
        mapPath: (path: string) => string;
        links: ReturnType<typeof catalogueLinkNormalizer>;
      }
    | undefined;
  const scopeFor = (moves: readonly EntryMove[]) => {
    if (!scope || scope.moves !== moves || scope.count !== moves.length)
      scope = {
        moves,
        count: moves.length,
        mapPath: baselinePathMapper(before, after, moves),
        links: catalogueLinkNormalizer(before, after, moves, resources),
      };
    return scope;
  };
  const normalized = (
    base: MoveDocument,
    head: MoveDocument,
    moves: readonly EntryMove[],
  ) => {
    const left = baseDocuments.get(base.route);
    const right = headDocuments.get(head.route);
    if (left === undefined || right === undefined)
      throw new MoklyError(
        "review-invalid",
        `Move comparison document is missing: ${left === undefined ? base.route : head.route}`,
      );
    return normalizeReviewPair(
      stripMarkers(left, base.usage),
      stripMarkers(right, head.usage),
      head.route,
      scopeFor(moves).links(base.route, head.route),
    );
  };
  const sameViews = (
    base: ManifestEntry,
    head: ManifestEntry,
    moves: readonly EntryMove[],
    mapPath: (path: string) => string,
  ): boolean => {
    const left = moveDocuments(base);
    const right = moveDocuments(head);
    if (left.length !== right.length) return false;
    return left.every((view) => {
      const other = right.find((item) => item.key === view.key);
      if (!other) return false;
      const pair = normalized(view, other, moves);
      const usage = view.usage
        ? {
            ...view.usage,
            instances: view.usage.instances.map((instance) => ({
              ...instance,
              componentId: mapPath(instance.componentId),
            })),
          }
        : undefined;
      const signals = componentUsageSignals(usage, other.usage);
      return pair.base === pair.head && !signals.inputs && !signals.structure;
    });
  };
  return {
    fingerprint(candidate, side, moves) {
      const entry = (side === "before" ? bases : heads).get(
        moveIdentity(candidate),
      )!;
      const scope = scopeFor(moves);
      return contentFingerprint(
        entry,
        side === "before" ? baseDocuments : headDocuments,
        side,
        scope.links,
        side === "before" ? scope.mapPath : (path) => path,
        side === "before" ? before : after,
        moves,
      );
    },
    identical(old, next, moves) {
      const { base, head } = entries(old, next);
      const { mapPath } = scopeFor(moves);
      if (base.kind === "use-case" && head.kind === "use-case")
        return (
          canonicalJson(
            base.steps.map((step) => ({
              ...step,
              screenPath: mapPath(step.screenPath),
            })),
          ) === canonicalJson(head.steps)
        );
      if (
        base.kind === "component" &&
        head.kind === "component" &&
        !isManifestComponentVariant(base) &&
        !isManifestComponentVariant(head)
      ) {
        const structure = (entry: typeof base) => ({
          propSchema: entry.propSchema,
          slots: entry.slots,
          controls: entry.controls,
        });
        return (
          canonicalJson(structure(base)) === canonicalJson(structure(head)) &&
          pairedVariants(
            base.path,
            head.path,
            before,
            after,
            moves,
            (left, right) =>
              sameViews(left, right, moves, (path) =>
                path.toLowerCase() === base.path.toLowerCase()
                  ? head.path
                  : mapPath(path),
              ),
          )
        );
      }
      return sameViews(base, head, moves, mapPath);
    },
    similarity(old, next, moves) {
      const { base, head } = entries(old, next);
      if (base.kind === "document" && head.kind === "document") {
        const left = markdown?.before.get(base.sourcePath),
          right = markdown?.after.get(head.sourcePath);
        return left?.trim() && right?.trim()
          ? documentSimilarity(left, right)
          : 0;
      }
      const left = moveDocuments(base).find((view) => view.key === "light");
      const right = moveDocuments(head).find((view) => view.key === "light");
      if (!left || !right) return 0;
      const pair = normalized(left, right, moves);
      const beforeText = visiblePageText(pair.base),
        afterText = visiblePageText(pair.head);
      return beforeText && afterText
        ? documentSimilarity(beforeText, afterText)
        : 0;
    },
  };
}

function pairedVariants(
  beforePath: string,
  afterPath: string,
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  moves: readonly EntryMove[],
  identical: (base: ManifestEntry, head: ManifestEntry) => boolean,
): boolean {
  const variants = (entries: readonly ManifestEntry[], parent: string) =>
    entries.filter(
      (entry) =>
        entry.kind === "component" &&
        isManifestComponentVariant(entry) &&
        entry.variantOf === parent,
    );
  const bases = variants(before, beforePath);
  const heads = variants(after, afterPath);
  if (bases.length !== heads.length) return false;
  const paired = new Map(moves.map((move) => [move.path, move.previousPath]));
  const claimed = new Set([
    ...moves.map((move) => move.previousPath.toLowerCase()),
    ...after
      .filter((entry) => entry.kind === "component")
      .map((entry) => entry.path.toLowerCase()),
  ]);
  return heads.every((head) => {
    if (head.movedFrom !== undefined && !paired.has(head.path)) return false;
    const previous =
      paired.get(head.path) ??
      `${beforePath}/${head.path.slice(afterPath.length + 1)}`;
    const base = bases.find(
      (base) => base.path.toLowerCase() === previous.toLowerCase(),
    );
    return Boolean(
      base &&
      (paired.has(head.path) ||
        (!claimed.has(base.path.toLowerCase()) && identical(base, head))),
    );
  });
}
