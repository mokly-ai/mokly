import fs from "node:fs";
import promises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types } from "node:util";

import { markFileReader, observeBytes } from "./postcss-evidence.js";

type ReadOptions = { raw: unknown; encoding?: BufferEncoding };
let installed = false;

/** Exotic options and handles keep native behaviour and incomplete coverage. */
function options(value: unknown): ReadOptions | undefined {
  if (value === null || value === undefined) return { raw: value };
  if (typeof value === "string")
    return Buffer.isEncoding(value)
      ? { raw: null, encoding: value }
      : undefined;
  if (typeof value !== "object" || types.isProxy(value)) return undefined;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return undefined;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (
    Object.values(fields).some((field) => field.get || field.set) ||
    fields.buffer
  )
    return undefined;
  const encoding: unknown = fields.encoding?.value;
  if (
    encoding !== undefined &&
    encoding !== null &&
    (typeof encoding !== "string" || !Buffer.isEncoding(encoding))
  )
    return undefined;
  fields.encoding = { ...fields.encoding, value: null };
  return {
    raw: Object.create(Object.getPrototypeOf(value), fields),
    ...(typeof encoding === "string" && Buffer.isEncoding(encoding)
      ? { encoding }
      : {}),
  };
}

function filename(value: unknown): string | undefined {
  if (types.isProxy(value)) return undefined;
  if (typeof value === "string") return path.resolve(value);
  if (value instanceof URL && value.protocol === "file:") {
    try {
      return fileURLToPath(value);
    } catch {
      return undefined;
    }
  }
  if (Buffer.isBuffer(value)) {
    const text = value.toString();
    if (Buffer.from(text).equals(value)) return path.resolve(text);
  }
  return undefined;
}

function deliver(
  file: string,
  value: unknown,
  encoding?: BufferEncoding,
): unknown {
  if (!Buffer.isBuffer(value)) return value;
  observeBytes(file, value);
  return encoding ? value.toString(encoding) : value;
}

/** Observe path-based whole-file APIs before delivery; descriptor offsets stay opaque. */
export function observeFileReads(): void {
  if (installed) return;
  installed = true;
  const sync = fs.readFileSync;
  const callback = fs.readFile;
  const promise = promises.readFile;
  Object.defineProperty(fs, "readFileSync", {
    value: function (...args: unknown[]): unknown {
      const file = filename(args[0]);
      const selected = options(args[1]);
      if (!file || !selected) return Reflect.apply(sync, fs, args);
      const bytes: unknown = Reflect.apply(sync, fs, [args[0], selected.raw]);
      return deliver(file, bytes, selected.encoding);
    },
  });
  Object.defineProperty(fs, "readFile", {
    value: function (...args: unknown[]): unknown {
      const file = filename(args[0]);
      const done = args.length === 2 ? args[1] : args[2];
      const selected = options(args.length === 2 ? undefined : args[1]);
      if (!file || !selected || typeof done !== "function")
        return Reflect.apply(callback, fs, args);
      return Reflect.apply(callback, fs, [
        args[0],
        selected.raw,
        function (this: unknown, error: unknown, bytes: unknown) {
          return Reflect.apply(done, this, [
            error,
            error ? bytes : deliver(file, bytes, selected.encoding),
          ]);
        },
      ]);
    },
  });
  Object.defineProperty(promises, "readFile", {
    value: async function (...args: unknown[]): Promise<unknown> {
      const file = filename(args[0]);
      const selected = options(args[1]);
      if (!file || !selected) return Reflect.apply(promise, promises, args);
      const bytes: unknown = await Reflect.apply(promise, promises, [
        args[0],
        selected.raw,
      ]);
      return deliver(file, bytes, selected.encoding);
    },
  });
  markFileReader(fs.readFileSync);
  markFileReader(promises.readFile);
  syncBuiltinESMExports();
}
