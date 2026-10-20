import type { FileHandle } from "node:fs/promises";

import {
  delivered,
  readArguments,
  vectorBytes,
  vectorInputs,
} from "./postcss-read-arguments.js";
import { options } from "./postcss-read-options.js";
import { begin, closed, finish, invalidate } from "./postcss-read-position.js";

const handles = new WeakMap<object, FileHandle>();

export function handleDescriptor(value: unknown): number | undefined {
  return typeof value === "object" && value !== null
    ? handles.get(value)?.fd
    : undefined;
}

/** Every public write boundary invalidates the same descriptor state. */
export function mutateDescriptor(value: unknown, close = false): void {
  const fd = typeof value === "number" ? value : handleDescriptor(value);
  if (fd === undefined) return;
  if (close) closed(fd);
  else invalidate(fd);
}

/** FileHandle streams call the same read method, so their delivered ranges share this ledger. */
export function observeHandle(handle: FileHandle): void {
  handles.set(handle, handle);
  for (const name of ["read", "readv"] as const) {
    const original = handle[name];
    Object.defineProperty(handle, name, {
      configurable: true,
      writable: true,
      value: async function (this: FileHandle, ...args: unknown[]) {
        const meta =
          name === "readv"
            ? {
                offset: 0,
                position: typeof args[1] === "number" ? args[1] : null,
                length: undefined,
              }
            : readArguments(args);
        if (!meta) {
          invalidate(this.fd);
          return Reflect.apply(original, this, args);
        }
        const vectors = name === "readv" ? vectorInputs(args[0]) : undefined;
        const ticket = begin(this.fd, meta.position);
        try {
          const result: {
            bytesRead: number;
            buffer?: unknown;
            buffers?: unknown;
          } = await Reflect.apply(original, this, args);
          const bytes =
            name === "readv"
              ? vectorBytes(vectors, result.bytesRead)
              : delivered(result.buffer, meta.offset, result.bytesRead);
          finish(
            ticket,
            bytes,
            bytes?.length === 0 &&
              (name === "readv"
                ? vectors?.some((buffer) => buffer.byteLength > 0) === true
                : (meta.length ?? 0) > 0),
          );
          return result;
        } catch (error) {
          finish(ticket);
          throw error;
        }
      },
    });
  }
  const readFile = handle.readFile;
  Object.defineProperty(handle, "readFile", {
    configurable: true,
    writable: true,
    value: async function (this: FileHandle, ...args: unknown[]) {
      const selected = options(args[0]);
      if (!selected) {
        invalidate(this.fd);
        return Reflect.apply(readFile, this, args);
      }
      const ticket = begin(this.fd, null);
      try {
        const bytes: Buffer = await Reflect.apply(readFile, this, [
          selected.raw,
        ]);
        finish(ticket, bytes, true);
        return selected.encoding ? bytes.toString(selected.encoding) : bytes;
      } catch (error) {
        finish(ticket);
        throw error;
      }
    },
  });
  for (const name of [
    "write",
    "writev",
    "writeFile",
    "appendFile",
    "close",
  ] as const) {
    const original = handle[name];
    Object.defineProperty(handle, name, {
      configurable: true,
      writable: true,
      value: function (this: FileHandle, ...args: unknown[]) {
        mutateDescriptor(this, name === "close");
        return Reflect.apply(original, this, args);
      },
    });
  }
}
