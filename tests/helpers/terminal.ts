import { EventEmitter } from "node:events";
import { Writable } from "node:stream";

import type {
  CliInput,
  CliOutput,
  TerminalEnvironment,
} from "../../packages/mokly/dist/cli/reporter/types.js";

interface MemoryTerminalOptions {
  columns?: number;
  env?: NodeJS.ProcessEnv;
  inputEnded?: boolean;
  inputTTY?: boolean;
  isTTY: boolean;
}

const ANSI_CONTROL = new RegExp(
  `^${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`,
  "u",
);

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

/** Apply basic carriage-return and erase-line output to a terminal line buffer. */
export function emulateTerminal(value: string): {
  currentLine: string;
  lines: string[];
} {
  const lines: string[] = [];
  let current: string[] = [];
  let cursor = 0;
  for (let index = 0; index < value.length;) {
    if (value.startsWith("\x1b[2K", index)) {
      current = [];
      index += 4;
      continue;
    }
    const control = ANSI_CONTROL.exec(value.slice(index));
    if (control) {
      index += control[0].length;
      continue;
    }
    const character = String.fromCodePoint(value.codePointAt(index)!);
    index += character.length;
    if (character === "\r") {
      cursor = 0;
      continue;
    }
    if (character === "\n") {
      lines.push(current.join(""));
      current = [];
      cursor = 0;
      continue;
    }
    while (current.length < cursor) current.push(" ");
    current[cursor++] = character;
  }
  return { currentLine: current.join(""), lines };
}
