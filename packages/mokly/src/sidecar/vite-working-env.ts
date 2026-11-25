import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import fs from "node:fs";
import type { Stats } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

import type { ViteBaseEnv } from "../generated/sidecar/ViteBaseEnv.js";
import type { ViteEnvInput } from "../generated/sidecar/ViteEnvInput.js";

import { missingFile } from "./file-digests.js";
import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { filename, options } from "./postcss-read-options.js";
import { ViteBaseEnv as BaseEnv } from "./vite-base-env.js";
import type { EnvSelection } from "./vite-base-env.js";
import { setupCandidate, setupChanged } from "./vite-setup-input.js";

export function envFiles(mode: string, directory: string | false): string[] {
  return directory === false
    ? []
    : [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`].map((file) =>
        path.join(directory, file),
      );
}

interface Observation extends EnvSelection {
  candidate: string;
  stat: Stats | undefined;
  bytes?: Buffer;
  digest?: string;
}

const active = new AsyncLocalStorage<ViteEnv>();
const stat = fs.statSync;
const read = fs.readFileSync;
let installed = false;

/** Serve one snapshot per dotenv candidate to the config and Vite's env loader. */
export class ViteEnv {
  private readonly base: BaseEnv | undefined;
  private readonly names: Set<string>;
  private readonly observations = new Map<string, Observation>();
  private reading = false;

  constructor(
    base: ViteBaseEnv | undefined,
    private readonly paths: ModulePaths,
    mode: string,
  ) {
    this.base = base && new BaseEnv(base, paths.sourceRoot);
    this.names = new Set(envFiles(mode, ""));
  }

  async run<T>(run: () => Promise<T>): Promise<T> {
    installHooks();
    this.reading = true;
    try {
      return await active.run(this, run);
    } finally {
      this.reading = false;
    }
  }

  observation(request: unknown): Observation | undefined {
    if (!this.reading) return;
    const candidate = filename(request);
    if (
      !candidate ||
      !this.names.has(path.basename(candidate)) ||
      (!inside(this.paths.sourceRoot, candidate) &&
        !this.paths.dependencyDirectory(candidate))
    )
      return;
    const prior = this.observations.get(candidate);
    if (prior) return prior;
    const selected = this.select(candidate);
    const observed = {
      ...selected,
      candidate,
      stat: selected.file === null ? undefined : dotenvStat(selected.file),
    };
    this.observations.set(candidate, observed);
    return observed;
  }

  private select(candidate: string): EnvSelection {
    return this.base?.select(candidate) ?? { file: candidate, working: false };
  }

  async snapshot(files: readonly string[]): Promise<Map<string, ViteEnvInput>> {
    const required = new Set(files);
    const candidates = new Set([...files, ...this.observations.keys()]);
    return new Map(
      await Promise.all(
        [...candidates].map(async (candidate) => {
          const { file, working } = this.select(candidate);
          const root = this.paths.sourceRoot;
          const name = inside(root, candidate)
            ? logical(root, candidate)
            : this.paths.metadataName(await this.paths.metadata(candidate));
          const digest =
            file === null ? null : (await setupCandidate(name, file)).digest;
          return [
            candidate,
            {
              name,
              file,
              digest,
              working,
              render: required.has(candidate),
            },
          ] as const;
        }),
      ),
    );
  }

  verify(inputs: ReadonlyMap<string, ViteEnvInput>): void {
    for (const [candidate, { name, file, digest, working }] of inputs) {
      const observed = this.observations.get(candidate);
      if (!observed) continue;
      if (
        file !== observed.file ||
        working !== observed.working ||
        (observed.digest !== undefined
          ? digest !== observed.digest
          : (digest !== null) !== Boolean(observed.stat?.isFile()))
      )
        setupChanged(name);
      delete observed.bytes;
    }
  }
}

function installHooks(): void {
  if (installed) return;
  installed = true;
  Object.defineProperty(fs, "statSync", {
    value: (...args: unknown[]): unknown => {
      const observation = active.getStore()?.observation(args[0]);
      if (!observation) return Reflect.apply(stat, fs, args);
      const settings = args[1];
      if (
        settings &&
        typeof settings === "object" &&
        "bigint" in settings &&
        settings.bigint &&
        observation.file !== null
      )
        return Reflect.apply(stat, fs, [observation.file, ...args.slice(1)]);
      if (
        observation.stat ||
        (settings &&
          typeof settings === "object" &&
          "throwIfNoEntry" in settings &&
          settings.throwIfNoEntry === false)
      )
        return observation.stat;
      throw absent(observation.file ?? observation.candidate);
    },
  });
  Object.defineProperty(fs, "readFileSync", {
    value: (...args: unknown[]): unknown => {
      const observation = active.getStore()?.observation(args[0]);
      if (!observation) return Reflect.apply(read, fs, args);
      if (observation.file === null) throw absent(observation.candidate);
      const selected = options(args[1]);
      if (!selected || (observation.stat && !observation.stat.isFile()))
        return Reflect.apply(read, fs, [observation.file, ...args.slice(1)]);
      if (!observation.stat) throw absent(observation.file);
      if (!observation.bytes) {
        const bytes: unknown = Reflect.apply(read, fs, [
          observation.file,
          selected.raw,
        ]);
        if (!Buffer.isBuffer(bytes)) return bytes;
        observation.bytes = bytes;
        observation.digest = createHash("sha256").update(bytes).digest("hex");
      }
      return selected.encoding
        ? observation.bytes.toString(selected.encoding)
        : Buffer.from(observation.bytes);
    },
  });
  syncBuiltinESMExports();
}

function absent(file: string): Error {
  return Object.assign(
    new Error(`ENOENT: no such file or directory, '${file}'`),
    {
      code: "ENOENT",
      path: file,
    },
  );
}

function dotenvStat(file: string): Stats | undefined {
  try {
    return stat(file, { throwIfNoEntry: false });
  } catch (error) {
    if (missingFile(error)) return;
    throw error;
  }
}
