import { CacheError } from "./errors.js";
import { ARTIFACT_LIMIT, JSON_LIMIT } from "./metadata.js";

/** Count upload bytes without buffering; validate conditional losers too. */
export function countedUpload(
  body: ReadableStream<Uint8Array> | null,
  expected: number,
) {
  const reader = body?.getReader();
  let bytes = 0;
  let complete = false;
  let failure: unknown;
  const next = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    if (failure) throw failure;
    const result = reader
      ? await reader.read()
      : { done: true as const, value: undefined };
    if (result.done) {
      complete = true;
      if (bytes !== expected)
        throw new CacheError(
          400,
          "bad_request",
          "Artifact length does not match Content-Length.",
        );
    } else {
      bytes += result.value.byteLength;
      if (bytes > ARTIFACT_LIMIT)
        throw new CacheError(413, "too_large", "Cache request is too large.");
      if (bytes > expected)
        throw new CacheError(
          400,
          "bad_request",
          "Artifact length does not match Content-Length.",
        );
    }
    return result;
  };
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const result = await next();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        } catch (error) {
          failure = error;
          controller.error(error);
        }
      },
    },
    { highWaterMark: 0 },
  );
  return {
    stream,
    async finish() {
      if (failure) throw failure;
      while (!complete) await next();
    },
    async cancel() {
      await reader?.cancel().catch(() => undefined);
    },
    get failure() {
      return failure;
    },
  };
}

/** JSON is bounded to one MiB; artifact requests never use this reader. */
export async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (reader) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > JSON_LIMIT)
        throw new CacheError(
          413,
          "too_large",
          "Cache JSON request is too large.",
        );
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
          bytes,
        ),
      ) as unknown;
    } catch {
      throw new CacheError(400, "bad_request", "Invalid cache JSON.");
    }
  } finally {
    await reader?.cancel().catch(() => undefined);
  }
}
