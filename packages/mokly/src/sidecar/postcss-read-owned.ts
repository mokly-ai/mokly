import fs from "node:fs";
import promises from "node:fs/promises";
import { types } from "node:util";

import type { PostcssFileIdentity } from "../generated/sidecar/PostcssFileIdentity.js";

import { fileIdentity } from "./postcss-file-identity.js";

const open = fs.open;
const close = fs.close;
const read = fs.readFile;
const promiseOpen = promises.open;
const promiseRead = promises.readFile;
const flags = new Set([
  "r",
  "rs",
  "sr",
  "r+",
  "rs+",
  "sr+",
  "w",
  "wx",
  "xw",
  "w+",
  "wx+",
  "xw+",
  "a",
  "ax",
  "xa",
  "as",
  "sa",
  "a+",
  "ax+",
  "xa+",
  "as+",
  "sa+",
]);
function flag(raw: unknown): unknown {
  return raw && typeof raw === "object"
    ? (Object.getOwnPropertyDescriptor(raw, "flag")?.value ?? "r")
    : "r";
}

/** Native flag and signal forms can retain one descriptor through observation. */
export function ownedRead(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (typeof raw !== "object") return false;
  const fields = Object.getOwnPropertyDescriptors(raw);
  const selected = flag(raw);
  if (
    !(typeof selected === "string" && flags.has(selected)) &&
    !(
      typeof selected === "number" &&
      Number.isInteger(selected) &&
      selected >= -2147483648 &&
      selected <= 2147483647
    )
  )
    return false;
  const signal: unknown = fields.signal?.value;
  if (signal === undefined) return true;
  if (
    types.isProxy(signal) ||
    !(signal instanceof AbortSignal) ||
    Object.getPrototypeOf(signal) !== AbortSignal.prototype
  )
    return false;
  return !signal.aborted;
}

export function readOwned(
  file: unknown,
  name: string,
  raw: unknown,
  done: (
    error: unknown,
    bytes: unknown,
    identity?: PostcssFileIdentity,
  ) => void,
): void {
  Reflect.apply(open, fs, [
    file,
    flag(raw),
    (error: unknown, fd: number) => {
      if (error) {
        done(error, undefined);
        return;
      }
      const identity = fileIdentity(fd, name);
      Reflect.apply(read, fs, [
        fd,
        raw,
        (error: unknown, bytes: unknown) => {
          close(fd, (closeError) => done(error || closeError, bytes, identity));
        },
      ]);
    },
  ]);
}

export async function readOwnedPromise(
  file: unknown,
  name: string,
  raw: unknown,
): Promise<{ bytes: Buffer; identity?: PostcssFileIdentity }> {
  const handle: promises.FileHandle = await Reflect.apply(
    promiseOpen,
    promises,
    [file, flag(raw)],
  );
  const identity = fileIdentity(handle.fd, name);
  let bytes: Buffer;
  try {
    bytes = await Reflect.apply(promiseRead, promises, [handle, raw]);
  } catch (error) {
    try {
      await handle.close();
    } catch (closeError) {
      if (error instanceof Error) {
        const code: unknown = "code" in error ? error.code : undefined;
        throw Object.assign(
          new AggregateError([error, closeError], error.message),
          { code },
        );
      }
      throw closeError;
    }
    throw error;
  }
  await handle.close();
  return { bytes, ...(identity ? { identity } : {}) };
}
