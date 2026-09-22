import {
  MAX_PREVIEW_DOCUMENT_BYTES,
  createPreviewPresentationLoader,
} from "../../packages/viewer/src/previews/presentation.js";
import type { LoadedPreview } from "../../packages/viewer/src/previews/request.js";

interface PresentationHarnessOptions {
  bodyBytes?: number;
  contentType?: string;
  finalUrl?: string;
  html?: string;
  status?: number;
}

interface PresentationHarnessResult {
  credentials: RequestCredentials | undefined;
  snapshotAddress: string;
  srcdoc: string;
}

declare global {
  interface Window {
    loadPreviewPresentation(
      options?: PresentationHarnessOptions,
    ): Promise<PresentationHarnessResult>;
    previewDocumentAddress: string;
    previewDocumentLimit: number;
  }
}

const generation =
  "https://artifact.test/__mokly/diffs/__generations/presentation/";
const snapshotAddress = `${generation}snapshots/before/archive/page.html`;

function byteBody(size: number): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(1024 * 1024).fill(97);
  let remaining = size;
  return new ReadableStream({
    pull(controller) {
      if (remaining === 0) {
        controller.close();
        return;
      }
      const length = Math.min(bytes.byteLength, remaining);
      controller.enqueue(bytes.subarray(0, length));
      remaining -= length;
    },
  });
}

function response(options: PresentationHarnessOptions): Response {
  const body = options.bodyBytes
    ? byteBody(options.bodyBytes)
    : (options.html ?? "<!doctype html><p>Previous page</p>");
  const value = new Response(body, {
    headers: {
      "content-type": options.contentType ?? "text/html; charset=utf-8",
    },
    status: options.status ?? 200,
  });
  Object.defineProperty(value, "url", {
    value: options.finalUrl ?? snapshotAddress,
  });
  return value;
}

window.previewDocumentAddress = snapshotAddress;
window.previewDocumentLimit = MAX_PREVIEW_DOCUMENT_BYTES;
window.loadPreviewPresentation = async (options = {}) => {
  let credentials: RequestCredentials | undefined;
  const loaded: LoadedPreview = {
    content: { kind: "page", url: snapshotAddress },
    generation,
    url: `${generation}review.json`,
  };
  const loader = createPreviewPresentationLoader(
    loaded,
    { kind: "pinned", comparisonUrl: `${generation}review.json` },
    {
      baseUrl: generation,
      fetch: async (_input, init) => {
        credentials = init?.credentials;
        return response(options);
      },
      parse: (source) => new DOMParser().parseFromString(source, "text/html"),
    },
  );
  const presentation = await loader.load(
    snapshotAddress,
    new AbortController().signal,
  );
  return { credentials, ...presentation };
};

export {};
