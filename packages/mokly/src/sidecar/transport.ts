import { TextDecoder } from "node:util";

import { protocol } from "./errors.js";
import { jsonText } from "./json.js";
import { captureRequestId } from "./request-id.js";

export const FRAME_LIMIT = 64 * 1024 * 1024;

/** Decode byte chunks before UTF-8, so split multibyte characters are valid. */
export async function* frames(
  stream: AsyncIterable<Uint8Array>,
  limit = FRAME_LIMIT,
): AsyncGenerator<unknown> {
  const pieces: Buffer[] = [];
  let bytes = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for await (const raw of stream) {
    const chunk = Buffer.from(raw);
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] !== 10) continue;
      bytes += i - start;
      if (bytes > limit) protocol(`frame exceeds ${limit} bytes`);
      pieces.push(chunk.subarray(start, i));
      const body = Buffer.concat(pieces, bytes);
      pieces.length = 0;
      bytes = 0;
      start = i + 1;
      let parsed: unknown;
      try {
        const json = decoder.decode(body);
        parsed = JSON.parse(json);
        captureRequestId(json, parsed);
      } catch {
        protocol("invalid JSON or UTF-8 frame");
      }
      yield parsed;
    }
    if (start < chunk.length) {
      pieces.push(chunk.subarray(start));
      bytes += chunk.length - start;
      if (bytes > limit) protocol(`frame exceeds ${limit} bytes`);
    }
  }
  if (bytes) protocol("unterminated frame at end of stream");
}

export function encodeResponse(
  id: string,
  outcome: object,
  limit = FRAME_LIMIT,
): string {
  const payload = jsonText(outcome);
  const json = `{"id":${id},${payload.slice(1)}`;
  if (Buffer.byteLength(json) > limit) protocol(`frame exceeds ${limit} bytes`);
  return json + "\n";
}

export function encodeFrame(frame: unknown, limit = FRAME_LIMIT): string {
  const json = jsonText(frame);
  if (Buffer.byteLength(json) > limit) protocol(`frame exceeds ${limit} bytes`);
  return json + "\n";
}
