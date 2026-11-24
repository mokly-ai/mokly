import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

import type { ViteBaseEnv } from "../generated/sidecar/ViteBaseEnv.js";

import { missingFile } from "./file-digests.js";
import { inside, logical } from "./path-scope.js";
import { filename, options } from "./postcss-read-options.js";
import { setupCandidate } from "./vite-setup-input.js";
import type { SetupInput } from "./vite-setup-input.js";

export function envFiles(mode: string, directory: string | false): string[] {
  return directory === false
    ? []
    : [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`].map((file) =>
        path.join(directory, file),
      );
}

const active = new AsyncLocalStorage<ViteWorkingEnv>();
export const workingEnvPrefix = "node_modules/.mokly-roots/vite-env/";
let installed = false;

/** Select working candidates for Vite's native synchronous dotenv reads. */
export class ViteWorkingEnv {
  private readonly root: string;
  private readonly indexed: Set<string>;
  private readonly names: Set<string>;
  private readonly candidates = new Set<string>();
  private readonly consumed = new Map<string, string | null>();

  constructor(
    base: ViteBaseEnv,
    private readonly sourceRoot: string,
    mode: string,
  ) {
    this.root = fs.realpathSync.native(base.workingRoot);
    this.indexed = new Set(base.indexed);
    this.names = new Set(envFiles(mode, ""));
  }

  run<T>(run: () => T): T {
    installHooks();
    return active.run(this, run);
  }

  candidate(file: string | undefined): string | undefined {
    if (
      !file ||
      !this.names.has(path.basename(file)) ||
      !inside(this.sourceRoot, file)
    )
      return;
    const name = logical(this.sourceRoot, file);
    if (this.indexed.has(name)) return;
    try {
      if (fs.lstatSync(file, { throwIfNoEntry: false })) return;
    } catch (error) {
      if (!missingFile(error)) return;
    }
    this.candidates.add(name);
    return this.workingFile(name);
  }

  replaces(file: string): boolean {
    return (
      inside(this.sourceRoot, file) &&
      this.candidates.has(logical(this.sourceRoot, file))
    );
  }

  observe(file: string, digest: string | null): void {
    this.consumed.set(workingEnvPrefix + logical(this.root, file), digest);
  }

  matches(inputs: readonly SetupInput[]): boolean {
    const digests = new Map(inputs.map(({ name, digest }) => [name, digest]));
    return [...this.consumed].every(
      ([name, digest]) => digests.get(name) === digest,
    );
  }

  private workingFile(name: string): string | undefined {
    const file = path.join(this.root, name);
    try {
      const stat = fs.statSync(file, { throwIfNoEntry: false });
      if (!stat || stat.isFile()) return file;
    } catch {
      // Vite treats an unsuccessful dotenv stat as absence.
    }
  }

  async snapshot(): Promise<SetupInput[]> {
    const inputs: SetupInput[] = [];
    for (const name of this.candidates) {
      const file = this.workingFile(name);
      const inputName = workingEnvPrefix + name;
      const input = file
        ? await setupCandidate(inputName, file)
        : { name: inputName, file: undefined, digest: null };
      inputs.push(input);
    }
    return inputs;
  }
}

function installHooks(): void {
  if (installed) return;
  installed = true;
  const stat = fs.statSync;
  const read = fs.readFileSync;
  Object.defineProperty(fs, "statSync", {
    value: (...args: unknown[]): unknown => {
      const env = active.getStore();
      const file = env?.candidate(filename(args[0]));
      if (!file) return Reflect.apply(stat, fs, args);
      const value: unknown = Reflect.apply(stat, fs, [file, ...args.slice(1)]);
      if (value === undefined) env?.observe(file, null);
      return value;
    },
  });
  Object.defineProperty(fs, "readFileSync", {
    value: (...args: unknown[]): unknown => {
      const env = active.getStore();
      const file = env?.candidate(filename(args[0]));
      const selected = file && options(args[1]);
      if (!file || !selected) return Reflect.apply(read, fs, args);
      const bytes: unknown = Reflect.apply(read, fs, [file, selected.raw]);
      if (!Buffer.isBuffer(bytes)) return bytes;
      env?.observe(file, createHash("sha256").update(bytes).digest("hex"));
      return selected.encoding ? bytes.toString(selected.encoding) : bytes;
    },
  });
  syncBuiltinESMExports();
}
