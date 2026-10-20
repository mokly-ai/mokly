import fs from "node:fs";
import promises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

import { markFileReader, observeBytes } from "./postcss-evidence.js";
import { handleDescriptor } from "./postcss-read-handles.js";
import { filename, options } from "./postcss-read-options.js";
import {
  begin,
  finish,
  invalidate,
  nativeSyncReaders,
  wholeRead,
} from "./postcss-read-position.js";

let installed = false;

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
      if (typeof args[0] === "number" && selected && nativeSyncReaders()) {
        const bytes: unknown = Reflect.apply(sync, fs, [args[0], selected.raw]);
        return Buffer.isBuffer(bytes) && selected.encoding
          ? bytes.toString(selected.encoding)
          : bytes;
      }
      if (!file || !selected || !nativeSyncReaders())
        return Reflect.apply(sync, fs, args);
      const bytes: unknown = wholeRead(() =>
        Reflect.apply(sync, fs, [args[0], selected.raw]),
      );
      return deliver(file, bytes, selected.encoding);
    },
  });
  Object.defineProperty(fs, "readFile", {
    value: function (...args: unknown[]): unknown {
      const file = filename(args[0]);
      const fd = typeof args[0] === "number" ? args[0] : undefined;
      const done = args.length === 2 ? args[1] : args[2];
      const selected = options(args.length === 2 ? undefined : args[1]);
      if (
        (!file && fd === undefined) ||
        !selected ||
        typeof done !== "function"
      ) {
        if (fd !== undefined) invalidate(fd);
        return Reflect.apply(callback, fs, args);
      }
      const ticket = fd === undefined ? undefined : begin(fd, null);
      try {
        return Reflect.apply(callback, fs, [
          args[0],
          selected.raw,
          function (this: unknown, error: unknown, bytes: unknown) {
            if (fd !== undefined)
              finish(
                ticket,
                !error && Buffer.isBuffer(bytes) ? bytes : undefined,
                true,
              );
            return Reflect.apply(done, this, [
              error,
              error
                ? bytes
                : file
                  ? deliver(file, bytes, selected.encoding)
                  : Buffer.isBuffer(bytes) && selected.encoding
                    ? bytes.toString(selected.encoding)
                    : bytes,
            ]);
          },
        ]);
      } catch (error) {
        finish(ticket);
        throw error;
      }
    },
  });
  Object.defineProperty(promises, "readFile", {
    value: async function (...args: unknown[]): Promise<unknown> {
      const file = filename(args[0]);
      const fd = handleDescriptor(args[0]);
      const selected = options(args[1]);
      if ((!file && fd === undefined) || !selected) {
        if (fd !== undefined) invalidate(fd);
        return Reflect.apply(promise, promises, args);
      }
      const ticket = fd === undefined ? undefined : begin(fd, null);
      try {
        const bytes: unknown = await Reflect.apply(promise, promises, [
          args[0],
          selected.raw,
        ]);
        if (fd !== undefined)
          finish(ticket, Buffer.isBuffer(bytes) ? bytes : undefined, true);
        return file
          ? deliver(file, bytes, selected.encoding)
          : Buffer.isBuffer(bytes) && selected.encoding
            ? bytes.toString(selected.encoding)
            : bytes;
      } catch (error) {
        finish(ticket);
        throw error;
      }
    },
  });
  markFileReader(fs.readFileSync);
  markFileReader(promises.readFile);
  syncBuiltinESMExports();
}
