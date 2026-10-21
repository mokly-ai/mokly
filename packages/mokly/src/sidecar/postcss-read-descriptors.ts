import fs from "node:fs";
import promises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

import {
  delivered,
  readArguments,
  vectorBytes,
  vectorInputs,
} from "./postcss-read-arguments.js";
import { mutateDescriptor, observeHandle } from "./postcss-read-handles.js";
import { filename } from "./postcss-read-options.js";
import {
  begin,
  finish,
  invalidate,
  markSyncReader,
  opened,
} from "./postcss-read-position.js";

let installed = false;

/** Node's callback metadata preserves named results through util.promisify. */
function preserveSymbols(original: object, wrapped: object): void {
  for (const symbol of Object.getOwnPropertySymbols(original)) {
    const descriptor = Object.getOwnPropertyDescriptor(original, symbol);
    if (descriptor) Object.defineProperty(wrapped, symbol, descriptor);
  }
}

export function observeDescriptors(): void {
  if (installed) return;
  installed = true;
  const openSync = fs.openSync;
  fs.openSync = (...args) => {
    const fd = openSync(...args);
    const file = filename(args[0]);
    if (file) opened(fd, file);
    return fd;
  };
  const open = fs.open;
  Object.defineProperty(fs, "open", {
    value: function (...args: unknown[]) {
      const done = args.at(-1);
      if (typeof done !== "function") return Reflect.apply(open, fs, args);
      return Reflect.apply(open, fs, [
        ...args.slice(0, -1),
        function (this: unknown, ...values: unknown[]) {
          const file = filename(args[0]);
          if (!values[0] && typeof values[1] === "number" && file)
            opened(values[1], file);
          return Reflect.apply(done, this, values);
        },
      ]);
    },
  });
  const promiseOpen = promises.open;
  promises.open = async (...args) => {
    const handle = await promiseOpen(...args);
    const file = filename(args[0]);
    if (file) {
      opened(handle.fd, file);
      observeHandle(handle);
    }
    return handle;
  };
  for (const name of ["readSync", "readvSync"] as const) {
    const original = fs[name];
    Object.defineProperty(fs, name, {
      value: function (fd: number, ...args: unknown[]) {
        const meta =
          name === "readvSync"
            ? {
                offset: 0,
                position: typeof args[1] === "number" ? args[1] : null,
                length: undefined,
              }
            : readArguments(args);
        if (!meta) {
          invalidate(fd);
          return Reflect.apply(original, fs, [fd, ...args]);
        }
        const vectors = name.startsWith("readv")
          ? vectorInputs(args[0])
          : undefined;
        const ticket = begin(fd, meta.position);
        try {
          const count: number = Reflect.apply(original, fs, [fd, ...args]);
          const bytes =
            name === "readvSync"
              ? vectorBytes(vectors, count)
              : delivered(args[0], meta.offset, count);
          finish(
            ticket,
            bytes,
            bytes?.length === 0 &&
              (name === "readvSync"
                ? vectors?.some((buffer) => buffer.byteLength > 0) === true
                : (meta.length ?? 0) > 0),
          );
          return count;
        } catch (error) {
          finish(ticket);
          throw error;
        }
      },
    });
    preserveSymbols(original, fs[name]);
  }
  for (const name of ["read", "readv"] as const) {
    const original = fs[name];
    Object.defineProperty(fs, name, {
      value: function (fd: number, ...args: unknown[]) {
        const done = args.at(-1);
        const inputs = args.slice(0, -1);
        const meta =
          name === "readv"
            ? {
                offset: 0,
                position: typeof inputs[1] === "number" ? inputs[1] : null,
                length: undefined,
              }
            : readArguments(inputs);
        if (!meta || typeof done !== "function") {
          invalidate(fd);
          return Reflect.apply(original, fs, [fd, ...args]);
        }
        const vectors = name.startsWith("readv")
          ? vectorInputs(args[0])
          : undefined;
        const ticket = begin(fd, meta.position);
        try {
          return Reflect.apply(original, fs, [
            fd,
            ...inputs,
            function (this: unknown, ...values: unknown[]) {
              const bytes = values[0]
                ? undefined
                : name === "readv"
                  ? vectorBytes(vectors, values[1])
                  : delivered(values[2], meta.offset, values[1]);
              finish(
                ticket,
                bytes,
                bytes?.length === 0 &&
                  (name === "readv"
                    ? vectors?.some((buffer) => buffer.byteLength > 0) === true
                    : (meta.length ?? 0) > 0),
              );
              return Reflect.apply(done, this, values);
            },
          ]);
        } catch (error) {
          finish(ticket);
          throw error;
        }
      },
    });
    preserveSymbols(original, fs[name]);
  }
  for (const name of [
    "write",
    "writeSync",
    "writev",
    "writevSync",
    "writeFile",
    "writeFileSync",
    "appendFile",
    "appendFileSync",
    "close",
    "closeSync",
  ] as const) {
    const original = fs[name];
    Object.defineProperty(fs, name, {
      value: function (...args: unknown[]) {
        mutateDescriptor(args[0], name.startsWith("close"));
        return Reflect.apply(original, fs, args);
      },
    });
    preserveSymbols(original, fs[name]);
  }
  for (const name of ["writeFile", "appendFile"] as const) {
    const original = promises[name];
    Object.defineProperty(promises, name, {
      value: function (...args: unknown[]) {
        mutateDescriptor(args[0]);
        return Reflect.apply(original, promises, args);
      },
    });
  }
  markSyncReader(fs.openSync);
  markSyncReader(fs.readSync);
  syncBuiltinESMExports();
}
