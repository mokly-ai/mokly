import { EventEmitter } from "node:events";
import { Writable } from "node:stream";

import type {
  CliInput,
  CliOutput,
  TerminalEnvironment,
} from "../../dist/cli/reporter/types.js";

interface MemoryTerminalOptions {
  columns?: number;
  env?: NodeJS.ProcessEnv;
  inputEnded?: boolean;
  inputTTY?: boolean;
  isTTY: boolean;
}

class MemoryOutput extends Writable implements CliOutput {
  readonly chunks: string[] = [];
  constructor(
    readonly isTTY: boolean,
    readonly columns: number | undefined,
  ) {
    super();
  }
  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(chunk.toString());
    callback();
  }
}

class MemoryInput extends EventEmitter implements CliInput {
  isRaw = false;
  constructor(
    readonly isTTY: boolean,
    readonly readableEnded: boolean,
  ) {
    super();
  }
  pause(): this {
    return this;
  }
  resume(): this {
    return this;
  }
  setRawMode(value: boolean): this {
    this.isRaw = value;
    return this;
  }
}

export function memoryTerminal(options: MemoryTerminalOptions): {
  environment: TerminalEnvironment;
  stderr(): string;
  stdin: CliInput & EventEmitter & { isRaw: boolean };
  stdout(): string;
} {
  const stdout = new MemoryOutput(options.isTTY, options.columns);
  const stderr = new MemoryOutput(options.isTTY, options.columns);
  const stdin = new MemoryInput(
    options.inputTTY ?? true,
    options.inputEnded ?? false,
  );
  let milliseconds = 1_000;
  return {
    environment: {
      browserOpener: { async open() {} },
      env: options.env ?? { NO_COLOR: "1" },
      now: () => (milliseconds += 100),
      platform: "linux",
      stderr,
      stdin,
      stdout,
    },
    stderr: () => stderr.chunks.join(""),
    stdin,
    stdout: () => stdout.chunks.join(""),
  };
}
