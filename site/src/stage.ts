/**
 * The home stage: the Welcome screen of this repository's own example
 * catalogue, built by `scripts/stage.mjs` before Astro runs and described by
 * the manifest that script writes. Nothing here is authored by hand — the
 * screen documents, the catalogue trail and the navigation rows all come from
 * the example build output.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "astro/zod";

import { sitePath } from "./workspace.js";

/** The directory the stage build writes and Astro publishes as `/stage/`. */
export const STAGE_DIRECTORY = sitePath("public", "stage");

/** The site path the stage documents are served from. */
export const STAGE_PATH = "/stage/";

const stageDocument = z.object({
  scheme: z.enum(["light", "dark"]),
  viewport: z.enum(["mobile", "desktop"]),
  file: z.string().min(1),
});

const stageRow = z.object({
  count: z.number().int().nonnegative().nullable(),
  current: z.boolean(),
  depth: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  kind: z.enum(["collection", "component", "flow", "page", "screen"]),
  label: z.string().min(1),
});

const stageSection = z.object({
  rows: z.array(stageRow).min(1),
  title: z.string().min(1),
});

const stageManifest = z.object({
  documents: z.array(stageDocument).length(4),
  resources: z.array(z.string().min(1)),
  screen: z.string().min(1),
  screenId: z.string().min(1),
  sections: z.array(stageSection).min(1),
  trail: z.array(z.string().min(1)).min(1),
});

/** One published screen document: a viewport and scheme of the same screen. */
export type StageDocument = z.infer<typeof stageDocument>;

/** One row of the depicted catalogue navigation. */
export type StageRow = z.infer<typeof stageRow>;

/** One section of the depicted catalogue navigation. */
export type StageSection = z.infer<typeof stageSection>;

/** Everything the home page needs to render the framed catalogue. */
export type StageManifest = z.infer<typeof stageManifest>;

/** Validate a manifest read from disk, naming the first field that fails. */
export function parseStageManifest(value: unknown): StageManifest {
  const result = stageManifest.safeParse(value);
  if (!result.success) {
    const [issue] = result.error.issues;
    throw new Error(
      `The home stage manifest is invalid: ${issue?.path.join(".") ?? "manifest"} ${issue?.message ?? "did not parse"}. Run the site build to regenerate it.`,
    );
  }
  return result.data;
}

/** The site path of a published stage document. */
export function stageDocumentPath(document: StageDocument): string {
  return `${STAGE_PATH}${document.file}`;
}

/** Find the document for one viewport and scheme, or fail naming both. */
export function stageDocumentFor(
  manifest: StageManifest,
  viewport: StageDocument["viewport"],
  scheme: StageDocument["scheme"],
): StageDocument {
  const document = manifest.documents.find(
    (candidate) =>
      candidate.viewport === viewport && candidate.scheme === scheme,
  );
  if (!document) {
    throw new Error(
      `The home stage has no ${viewport} document in the ${scheme} scheme.`,
    );
  }
  return document;
}

/** Read the manifest the stage build wrote, explaining an absent build. */
export function readStageManifest(directory = STAGE_DIRECTORY): StageManifest {
  const file = path.join(directory, "manifest.json");
  if (!existsSync(file)) {
    throw new Error(
      "The home stage has not been built. Run `npm run site:build`, which builds the example catalogue first.",
    );
  }
  return parseStageManifest(JSON.parse(readFileSync(file, "utf8")));
}
