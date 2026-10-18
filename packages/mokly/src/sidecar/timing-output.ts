import type { Writable } from "node:stream";

/** Keep timing records separate from consumer writes without adding empty lines. */
export function timingOutput(stream: Pick<Writable, "write">) {
  const write = stream.write.bind(stream);
  let atLineStart = true;
  stream.write = (
    chunk: string | NodeJS.ArrayBufferView,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ) => {
    const bytes =
      typeof chunk === "string"
        ? Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8")
        : new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    if (bytes.length) atLineStart = bytes.at(-1) === 10;
    return typeof encoding === "string"
      ? write(chunk, encoding, callback)
      : write(chunk, encoding ?? callback);
  };
  return (line: string) => stream.write(`${atLineStart ? "" : "\n"}${line}`);
}
