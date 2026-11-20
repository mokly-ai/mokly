import type { Writable } from "node:stream";

type Done = (error?: Error | null) => void;

/**
 * Keep timing records separate from consumer writes without adding empty lines.
 * While quiet, the stream drops every other write; timing records still pass.
 */
export function timingOutput(stream: Pick<Writable, "write">) {
  const write = stream.write.bind(stream);
  let atLineStart = true;
  let quiet = false;
  stream.write = (
    chunk: string | NodeJS.ArrayBufferView,
    encoding?: BufferEncoding | Done,
    callback?: Done,
  ) => {
    if (quiet) {
      const done = typeof encoding === "function" ? encoding : callback;
      if (done) process.nextTick(done);
      return true;
    }
    const bytes =
      typeof chunk === "string"
        ? Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8")
        : new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    if (bytes.length) atLineStart = bytes.at(-1) === 10;
    return typeof encoding === "string"
      ? write(chunk, encoding, callback)
      : write(chunk, encoding ?? callback);
  };
  const record = (line: string) => {
    const text = `${atLineStart ? "" : "\n"}${line}`;
    atLineStart = text.endsWith("\n");
    return write(text);
  };
  return Object.assign(record, {
    /** Drop or pass the other writes of the stream from now on. */
    quiet: (value: boolean) => {
      quiet = value;
    },
  });
}
