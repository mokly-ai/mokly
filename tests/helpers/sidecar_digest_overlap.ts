import assert from "node:assert/strict";
import fs from "node:fs";
import type { TestContext } from "node:test";

interface InputFile {
  bytes: string;
  firstLength?: number;
  statSize?: number;
}

export function controlledReads(
  context: TestContext,
  files: Record<string, InputFile>,
) {
  const opened: string[] = [];
  const closed: number[] = [];
  const buffers = new Set<Buffer>();
  const lengths = new Map<string, number[]>();
  const handles = new Map<
    number,
    { file: string; bytes: Buffer; offset: number }
  >();
  const waiting: Array<{
    handle: number;
    complete(error?: NodeJS.ErrnoException): void;
  }> = [];
  context.mock.method(performance, "now", () => 0);
  context.mock.method(fs, "openSync", (file: string, flags: number) => {
    assert.equal(flags, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    assert.ok(files[file]);
    opened.push(file);
    lengths.set(file, []);
    handles.set(opened.length, {
      file,
      bytes: Buffer.from(files[file]!.bytes),
      offset: 0,
    });
    return opened.length;
  });
  context.mock.method(fs, "fstatSync", (handle: number) => {
    const entry = handles.get(handle)!;
    return {
      isFile: () => true,
      size: files[entry.file]!.statSize ?? entry.bytes.length,
    };
  });
  const copy = (handle: number, buffer: Buffer, limit: number) => {
    const entry = handles.get(handle)!;
    const length = Math.min(limit, entry.bytes.length - entry.offset);
    entry.bytes.copy(buffer, 0, entry.offset, entry.offset + length);
    entry.offset += length;
    lengths.get(entry.file)!.push(length);
    return length;
  };
  context.mock.method(
    fs,
    "read",
    (
      handle: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: null,
      callback: (error: NodeJS.ErrnoException | null, length: number) => void,
    ) => {
      assert.equal(offset, 0);
      assert.equal(length, 65_536);
      assert.equal(buffer.length, 65_536);
      assert.equal(position, null);
      buffers.add(buffer);
      waiting.push({
        handle,
        complete(error) {
          const file = handles.get(handle)!.file;
          if (error) callback(error, 0);
          else
            callback(
              null,
              copy(handle, buffer, files[file]!.firstLength ?? length),
            );
        },
      });
    },
  );
  context.mock.method(
    fs,
    "readSync",
    (
      handle: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: null,
    ) => {
      assert.equal(offset, 0);
      assert.equal(length, 65_536);
      assert.equal(position, null);
      return copy(handle, buffer, length);
    },
  );
  context.mock.method(fs, "closeSync", (handle: number) => {
    closed.push(handle);
  });
  return { opened, closed, buffers, lengths, waiting };
}
