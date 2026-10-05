import type { ColorScheme, Viewport } from "@mokly/viewer";
import { canonicalJson, isManifestComponentVariant } from "@mokly/viewer/data";
import { readMetadata } from "@mokly/viewer/runtime";

import {
  InteractiveDocumentError,
  InteractiveViewEligibilityError,
  InteractiveViewEligibilityReason,
} from "./errors.js";
import { buildInteractiveRouteTable } from "./route_table.js";
import type { InteractiveSourceEntry } from "./route_table.js";
import type { InteractiveBootstrap } from "./types.js";

const INSPECTOR_SCRIPT =
  '<script src="/__mokly/client/inspector.js" defer></script>';

export interface InteractiveBootstrapInput {
  catalogueSchemes: readonly ColorScheme[];
  colorScheme: ColorScheme;
  entries: readonly InteractiveSourceEntry[];
  entryPath: string;
  generation: string;
  sourceRoute: string;
  variantPath?: string;
  viewport: Viewport;
}

/** Validated browser bootstrap ready for insertion into a Live document. */
export interface InteractiveBootstrapBuild {
  bootstrap: InteractiveBootstrap;
}

/** Build browser-safe bootstrap data without props or repository paths. */
export function buildInteractiveBootstrap(
  input: InteractiveBootstrapInput,
): InteractiveBootstrapBuild {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.generation))
    throw invalid("generation must be a nonempty URL-safe value");
  const entry = input.entries.find(
    (candidate) => candidate.path === input.entryPath,
  );
  if (!entry)
    throw ineligible(
      InteractiveViewEligibilityReason.UnknownEntry,
      input.entryPath,
      input.variantPath,
    );
  if (entry.kind !== "screen" && entry.kind !== "component")
    throw ineligible(
      InteractiveViewEligibilityReason.NotLiveKind,
      input.entryPath,
      input.variantPath,
    );
  if (entry.interactive === false)
    throw ineligible(
      InteractiveViewEligibilityReason.OptedOut,
      input.entryPath,
      input.variantPath,
    );
  if (entry.kind === "component" && !input.variantPath)
    throw ineligible(
      InteractiveViewEligibilityReason.MissingVariant,
      input.entryPath,
    );
  if (entry.kind === "component") {
    const variant = input.entries.find(
      (candidate) =>
        candidate.kind === "component" &&
        isManifestComponentVariant(candidate) &&
        candidate.variantOf === entry.path &&
        candidate.path === input.variantPath,
    );
    if (!variant)
      throw ineligible(
        InteractiveViewEligibilityReason.UnknownVariant,
        input.entryPath,
        input.variantPath,
      );
    if (variant.interactive === false)
      throw ineligible(
        InteractiveViewEligibilityReason.OptedOut,
        input.entryPath,
        input.variantPath,
      );
  }
  if (entry.kind === "screen" && input.variantPath !== undefined)
    throw ineligible(
      InteractiveViewEligibilityReason.UnexpectedVariant,
      input.entryPath,
      input.variantPath,
    );
  const routes = buildInteractiveRouteTable({
    catalogueSchemes: input.catalogueSchemes,
    colorScheme: input.colorScheme,
    entries: input.entries,
    sourceRoute: input.sourceRoute,
    viewport: input.viewport,
  });
  return {
    bootstrap: {
      colorScheme: input.colorScheme,
      entryPath: entry.path,
      entryKind: entry.kind,
      generation: input.generation,
      routes,
      ...(input.variantPath ? { variantPath: input.variantPath } : {}),
      viewport: input.viewport,
    },
  };
}

/** Add Live head material while preserving every byte from `<body` onward. */
export function composeInteractiveDocument(
  adaptedDocument: string,
  built: InteractiveBootstrapBuild,
): string {
  inspectorMetadata(adaptedDocument);
  const bootstrap = `<script type="application/json" data-mokly-interactive>${inlineJson(
    built.bootstrap,
  )}</script>`;
  const moduleScript = `<script type="module" src="/__mokly/interactive/${built.bootstrap.generation}/bundle.js"></script>`;
  const head = headContentRange(adaptedDocument);
  const inspectorOffsets = exactOffsets(adaptedDocument, INSPECTOR_SCRIPT);
  if (inspectorOffsets.length !== 1)
    throw invalid("Live document needs exactly one Browse inspector script");
  const inspectorOffset = inspectorOffsets[0]!;
  const afterInspector = inspectorOffset + INSPECTOR_SCRIPT.length;
  if (inspectorOffset < head.start || afterInspector > head.end)
    throw invalid("Live inspector script must be inside the document head");
  return (
    adaptedDocument.slice(0, inspectorOffset) +
    bootstrap +
    INSPECTOR_SCRIPT +
    moduleScript +
    adaptedDocument.slice(afterInspector)
  );
}

/** Canonical JSON escaped so no value can terminate its script element. */
export function serializeInteractiveBootstrap(
  bootstrap: InteractiveBootstrap,
): string {
  return inlineJson(bootstrap);
}

function inspectorMetadata(document: string): void {
  const range = inspectorContentRange(document);
  if (!range) throw invalid("Live document requires Browse inspector metadata");
  const head = headContentRange(document);
  if (range.start < head.start || range.end > head.end)
    throw invalid("Live inspector metadata must be inside the document head");
  const metadata = readMetadata(document.slice(range.start, range.end));
  if (!metadata)
    throw invalid("Live document requires Browse inspector metadata");
}

function inspectorContentRange(
  document: string,
): { start: number; end: number } | undefined {
  const pattern = /<template data-mokly-inspector>([\s\S]*?)<\/template>/g;
  const matches = [...document.matchAll(pattern)];
  if (matches.length !== 1 || matches[0]?.index === undefined) return;
  const whole = matches[0][0];
  const content = matches[0][1] ?? "";
  const relative = whole.indexOf(content);
  return {
    start: matches[0].index + relative,
    end: matches[0].index + relative + content.length,
  };
}

function headContentRange(document: string): { start: number; end: number } {
  const start = /<head(?:\s[^>]*)?>/i.exec(document);
  const end = /<\/head\s*>/i.exec(document);
  if (!start || start.index + start[0].length > (end?.index ?? -1))
    throw invalid("Live document needs one explicit head");
  return { start: start.index + start[0].length, end: end!.index };
}

function exactOffsets(input: string, value: string): number[] {
  const offsets: number[] = [];
  let offset = input.indexOf(value);
  while (offset >= 0) {
    offsets.push(offset);
    offset = input.indexOf(value, offset + value.length);
  }
  return offsets;
}

function inlineJson(value: unknown): string {
  return canonicalJson(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function ineligible(
  reason: InteractiveViewEligibilityReason,
  entryPath: string,
  variantPath?: string,
): InteractiveViewEligibilityError {
  return new InteractiveViewEligibilityError(reason, entryPath, variantPath);
}

function invalid(message: string): InteractiveDocumentError {
  return new InteractiveDocumentError(message);
}
