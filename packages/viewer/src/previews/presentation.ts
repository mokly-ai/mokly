/** Fetch and prepare viewer-owned documents for historical previews. */

import type { ComparisonDelivery } from "../shell/comparison_context.js";

import { presentPreviewDocument } from "./presentation_document.js";
import type { LoadedPreview } from "./request.js";

/** Maximum historical HTML body accepted by the viewer. */
export const MAX_PREVIEW_DOCUMENT_BYTES = 67_108_864;

/** The immutable source identity and transformed `srcdoc` for one document. */
export interface PreviewPresentation {
  /** The requested snapshot address, before provider URL normalization. */
  snapshotAddress: string;
  /** Inert HTML serialization presented by the viewer-owned frame. */
  srcdoc: string;
}

/** Browser boundaries injected into the presentation pipeline. */
export interface PreviewPresentationEnvironment {
  /** Configured catalogue source whose origin owns the generation. */
  baseUrl: string | URL;
  /** Fetch one confined historical document. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  /** Parse HTML into an inert document. */
  parse(source: string): Document;
}

/** A per-loaded-preview cache of accepted historical presentations. */
export interface PreviewPresentationLoader {
  /** Load one metadata-named snapshot beneath the preview generation. */
  load(
    snapshotAddress: string,
    signal: AbortSignal,
  ): Promise<PreviewPresentation>;
}

interface PendingPresentation {
  promise: Promise<PreviewPresentation>;
  signal: AbortSignal;
}

/** Create the confined presentation cache owned by one loaded preview. */
export function createPreviewPresentationLoader(
  loaded: LoadedPreview,
  delivery: ComparisonDelivery,
  environment: PreviewPresentationEnvironment,
): PreviewPresentationLoader {
  const generation = generationUrl(loaded.generation, environment.baseUrl);
  const prefix = new URL("snapshots/before/", generation);
  const cache = new Map<string, PendingPresentation | PreviewPresentation>();
  return {
    async load(snapshotAddress, signal) {
      const requested = confinedSnapshot(snapshotAddress, generation, prefix);
      const cached = cache.get(requested.href);
      if (cached && "srcdoc" in cached) return cached;
      if (cached && !cached.signal.aborted) return cached.promise;
      const pending: PendingPresentation = {
        promise: loadPresentation(requested, delivery, environment, signal),
        signal,
      };
      cache.set(requested.href, pending);
      try {
        const presentation = await pending.promise;
        if (cache.get(requested.href) === pending)
          cache.set(requested.href, presentation);
        return presentation;
      } catch (error) {
        if (cache.get(requested.href) === pending) cache.delete(requested.href);
        throw error;
      }
    },
  };
}

async function loadPresentation(
  requested: URL,
  delivery: ComparisonDelivery,
  environment: PreviewPresentationEnvironment,
  signal: AbortSignal,
): Promise<PreviewPresentation> {
  signal.throwIfAborted();
  const response = await environment.fetch(requested, {
    credentials: delivery.kind === "pinned" ? "omit" : "same-origin",
    headers: { accept: "text/html" },
    signal,
  });
  if (
    !response.ok ||
    !sameResponseUrl(response.url, requested) ||
    mimeEssence(response.headers.get("content-type")) !== "text/html"
  )
    return unavailable();
  const source = await readBoundedBody(response, signal);
  signal.throwIfAborted();
  return presentPreviewDocument(environment.parse(source), requested.href);
}

function generationUrl(value: string, baseUrl: string | URL): URL {
  let generation: URL;
  let source: URL;
  try {
    generation = new URL(value);
    source = new URL(baseUrl);
  } catch {
    return unavailable();
  }
  if (
    !["http:", "https:"].includes(generation.protocol) ||
    generation.username ||
    generation.password ||
    generation.search ||
    generation.hash ||
    generation.origin !== source.origin ||
    !generation.pathname.endsWith("/")
  )
    return unavailable();
  return generation;
}

function confinedSnapshot(value: string, generation: URL, prefix: URL): URL {
  let snapshot: URL;
  try {
    snapshot = new URL(value);
  } catch {
    return unavailable();
  }
  if (
    snapshot.origin !== generation.origin ||
    snapshot.username ||
    snapshot.password ||
    snapshot.search ||
    snapshot.hash ||
    !snapshot.pathname.startsWith(prefix.pathname) ||
    snapshot.pathname === prefix.pathname
  )
    return unavailable();
  return snapshot;
}

function sameResponseUrl(responseUrl: string, requested: URL): boolean {
  let received: URL;
  try {
    received = new URL(responseUrl);
  } catch {
    return false;
  }
  const extensionless = requested.pathname.endsWith(".html")
    ? requested.pathname.slice(0, -".html".length)
    : undefined;
  return (
    received.origin === requested.origin &&
    !received.username &&
    !received.password &&
    received.search === "" &&
    received.hash === "" &&
    (received.pathname === requested.pathname ||
      received.pathname === extensionless)
  );
}

function mimeEssence(value: string | null): string | undefined {
  return value?.split(";", 1)[0]?.trim().toLowerCase();
}

async function readBoundedBody(
  response: Response,
  signal: AbortSignal,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  signal.throwIfAborted();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = (): void => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > MAX_PREVIEW_DOCUMENT_BYTES) {
        await cancelReader(reader);
        return unavailable();
      }
      chunks.push(next.value);
    }
  } finally {
    signal.removeEventListener("abort", abort);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    return;
  }
}

function unavailable(): never {
  throw new Error("The previous version is unavailable.");
}
