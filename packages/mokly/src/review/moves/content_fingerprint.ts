import { createHash } from "node:crypto";

import {
  canonicalJson,
  isManifestComponentVariant,
  type ManifestEntry,
} from "@mokly/viewer/data";

import { stripMarkers } from "../../components/comparison_material.js";
import { MoklyError } from "../../errors.js";
import {
  reviewFingerprintMaterial,
  type ReviewLinkNormalization,
} from "../ignore.js";

import { moveDocuments } from "./content.js";
import type { EntryMove } from "./types.js";

/** A conservative hash prefilter; full comparison checks usage and parent variants. */
export function contentFingerprint(
  entry: ManifestEntry,
  documents: ReadonlyMap<string, string>,
  side: "before" | "after",
  links: (before: string, after: string) => ReviewLinkNormalization,
  mapPath: (path: string) => string,
  catalogue: readonly ManifestEntry[],
  moves: readonly EntryMove[],
): { hash: string; ignores: string } {
  const ignores: unknown[] = [];
  let material: unknown;
  if (entry.kind === "use-case") {
    material = entry.steps.map((step) => ({
      ...step,
      screenPath: mapPath(step.screenPath),
    }));
  } else if (entry.kind === "component" && !isManifestComponentVariant(entry)) {
    material = {
      propSchema: entry.propSchema,
      slots: entry.slots,
      controls: entry.controls,
      variants: catalogue
        .filter(
          (candidate) =>
            candidate.kind === "component" &&
            isManifestComponentVariant(candidate) &&
            candidate.variantOf === entry.path,
        )
        .map((variant) => {
          const paired = moves.find(
            (move) =>
              move.kind === "component" &&
              (side === "before" ? move.previousPath : move.path) ===
                variant.path,
          );
          if (paired) return [paired.path, "paired"];
          const slug = variant.path.slice(entry.path.length + 1).toLowerCase();
          const signature = contentFingerprint(
            variant,
            documents,
            side,
            links,
            mapPath,
            catalogue,
            moves,
          );
          ignores.push([slug, signature.ignores]);
          return [slug, signature.hash];
        })
        .sort((a, b) => a[0]!.localeCompare(b[0]!)),
    };
  } else {
    material = moveDocuments(entry)
      .map((view) => {
        const content = documents.get(view.route);
        if (content === undefined)
          throw new MoklyError(
            "review-invalid",
            `Move comparison document is missing: ${view.route}`,
          );
        const normalized = reviewFingerprintMaterial(
          stripMarkers(content, view.usage),
          view.route,
          links(view.route, view.route)[side],
        );
        ignores.push([view.key, normalized.ignores]);
        return [view.key, normalized.material];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }
  return {
    hash: createHash("sha256").update(canonicalJson(material)).digest("hex"),
    ignores: canonicalJson(
      ignores.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))),
    ),
  };
}
