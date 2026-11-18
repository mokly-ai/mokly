import { protocol } from "./errors.js";
import { jsonText } from "./json.js";

export const FRAME_LIMIT = 64 * 1024 * 1024;

/** Decode byte chunks before UTF-8, so split multibyte characters are valid. */
export async function* frames(
  stream: AsyncIterable<Uint8Array>,
): AsyncGenerator<unknown> {
  const pieces: Buffer[] = [];
  let bytes = 0;
  for await (const raw of stream) {
    const chunk = Buffer.from(raw);
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] !== 10) continue;
      bytes += i - start;
      pieces.push(chunk.subarray(start, i));
      const body = Buffer.concat(pieces, bytes);
      pieces.length = 0;
      bytes = 0;
      start = i + 1;
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString("utf8"));
      } catch {
        protocol("invalid JSON frame");
      }
      yield parsed;
    }
    if (start < chunk.length) {
      pieces.push(chunk.subarray(start));
      bytes += chunk.length - start;
    }
  }
}

export function encodeFrame(frame: unknown, limit = FRAME_LIMIT): string {
  const json = jsonText(frame);
  if (Buffer.byteLength(json) > limit) protocol(`frame exceeds ${limit} bytes`);
  return json + "\n";
}
