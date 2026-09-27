/** Fetch and prepare viewer-owned snapshot presentations. */

import type { ComparisonDelivery } from "../shell/comparison_context.js";

import { presentSnapshotDocument } from "./presentation_document.js";
import {
  confinedSnapshot,
  snapshotGeneration,
  snapshotSideSet,
  type SnapshotSides,
} from "./snapshot_address.js";

export type { SnapshotSide, SnapshotSides } from "./snapshot_address.js";

/** Maximum snapshot HTML body accepted by the viewer. */
export const MAX_SNAPSHOT_DOCUMENT_BYTES = 67_108_864;

/** The immutable source identity and transformed `srcdoc` for one document. */
export interface SnapshotPresentation {
  /** The requested snapshot address, before provider URL normalization. */
  snapshotAddress: string;
  /** Inert HTML serialization presented by the viewer-owned frame. */
  srcdoc: string;
}

/** Browser boundaries injected into the presentation pipeline. */
export interface SnapshotPresentationEnvironment {
  /** Configured catalogue source whose origin owns the generation. */
  baseUrl: string | URL;
  /** Fetch one confined snapshot document. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  /** Parse HTML into an inert document. */
  parse(source: string): Document;
}

/** A per-generation cache of accepted snapshot presentations. */
export interface SnapshotPresentationLoader {
  /** Load one metadata-named snapshot beneath the configured generation. */
  load(
    snapshotAddress: string,
    signal: AbortSignal,
  ): Promise<SnapshotPresentation>;
}

interface PendingPresentation {
  promise: Promise<SnapshotPresentation>;
  signal: AbortSignal;
}

const COMPARISON_UNAVAILABLE = "The comparison is unavailable.";
const PREVIOUS_VERSION_UNAVAILABLE = "The previous version is unavailable.";

/** Create one generation-confined cache for the selected snapshot sides. */
export function createSnapshotPresentationLoader(
  generationAddress: string | URL,
  sides: SnapshotSides,
  delivery: ComparisonDelivery,
  environment: SnapshotPresentationEnvironment,
): SnapshotPresentationLoader {
  const allowedSides = snapshotSideSet(sides);
  const failureCopy = allowedSides.has("after")
    ? COMPARISON_UNAVAILABLE
    : PREVIOUS_VERSION_UNAVAILABLE;
  const generation = snapshotGeneration(
    generationAddress,
    environment.baseUrl,
    failureCopy,
  );
  const prefixes = Array.from(
    allowedSides,
    (side) => new URL(`snapshots/${side}/`, generation),
  );
  const cache = new Map<string, PendingPresentation | SnapshotPresentation>();
  return {
    async load(snapshotAddress, signal) {
      const requested = confinedSnapshot(
        snapshotAddress,
        generation,
        prefixes,
        failureCopy,
      );
      const cached = cache.get(requested.href);
      if (cached && "srcdoc" in cached) return cached;
      if (cached && !cached.signal.aborted) return cached.promise;
      const pending: PendingPresentation = {
        promise: loadPresentation(
          requested,
          delivery,
          environment,
          signal,
          failureCopy,
        ),
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
  environment: SnapshotPresentationEnvironment,
  signal: AbortSignal,
  failureCopy: string,
): Promise<SnapshotPresentation> {
  try {
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
      return unavailable(failureCopy);
    const source = await readBoundedBody(response, signal);
    signal.throwIfAborted();
    return presentSnapshotDocument(environment.parse(source), requested.href);
  } catch {
    signal.throwIfAborted();
    return unavailable(failureCopy);
  }
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
      if (length > MAX_SNAPSHOT_DOCUMENT_BYTES) {
        await cancelReader(reader);
        throw new RangeError("The snapshot document exceeds the body limit.");
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

function unavailable(message: string): never {
  throw new Error(message);
}
