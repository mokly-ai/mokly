/** Immutable filesystem generations for served Review artifacts. */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { MoklyError, errorMessage } from "../errors.js";

const GENERATION_RETENTION_MS = 60_000;
const REVIEW_ARTIFACT_MARKER = ".mokly-review-artifact";

/** Filesystem context excluded while generating a served Review artifact. */
export interface ReviewArtifactGenerationOptions {
  /** Package-owned directories that must not enter changed-path evidence. */
  readonly changedPathExclusions: readonly string[];
}

/** Provider that replaces one configured Review artifact directory. */
export interface ReviewArtifactProvider {
  /** Replace {@link outDir} with one complete Review artifact. */
  generate(options: ReviewArtifactGenerationOptions): Promise<void>;
  /** Configured directory holding the current Review artifact. */
  outDir: string;
}

/** One immutable artifact directory addressable by its server URL version. */
export interface ReviewGeneration {
  readonly directory: string;
  readonly version: string;
}

/** Preserve replaced artifacts briefly so in-flight pages remain coherent. */
export class ReviewGenerationStore {
  private archiveRoot: string | undefined;
  private readonly generations = new Map<string, ReviewGeneration>();
  private readonly retentionTimers = new Map<string, NodeJS.Timeout>();
  private readonly removals = new Set<Promise<void>>();
  private closed = false;
  private currentGeneration: ReviewGeneration | undefined;

  constructor(private readonly provider: ReviewArtifactProvider) {}

  /** Most recently completed generation, if the provider has run. */
  current(): ReviewGeneration | undefined {
    return this.currentGeneration;
  }

  /** Find a retained generation and extend its idle retention window. */
  get(version: string): ReviewGeneration | undefined {
    const generation = this.peek(version);
    if (generation && generation.version !== this.currentGeneration?.version)
      this.scheduleExpiry(generation);
    return generation;
  }

  /** Check retention without renewing it; bookkeeping must not keep artifacts alive. */
  peek(version: string): ReviewGeneration | undefined {
    return this.generations.get(version);
  }

  /** Replace the current artifact while retaining its immutable predecessor. */
  async generate(): Promise<ReviewGeneration> {
    const previous = this.currentGeneration;
    const archived = previous ? await this.archive(previous) : undefined;
    try {
      await this.provider.generate({
        changedPathExclusions: this.archiveRoot ? [this.archiveRoot] : [],
      });
      if (reviewDirectoryState(this.provider.outDir) === "missing") {
        throw new MoklyError(
          "server-failed",
          `Review provider did not generate an artifact at ${this.provider.outDir}`,
        );
      }
    } catch (error) {
      if (archived) await this.restore(archived, error);
      throw error;
    }
    const generation = {
      directory: path.resolve(this.provider.outDir),
      version: randomUUID(),
    };
    this.currentGeneration = generation;
    this.generations.set(generation.version, generation);
    if (archived) this.scheduleExpiry(archived);
    return generation;
  }

  /** Remove only temporary archives owned by this server instance. */
  async close(): Promise<void> {
    this.closed = true;
    for (const timer of this.retentionTimers.values()) clearTimeout(timer);
    this.retentionTimers.clear();
    await Promise.allSettled([...this.removals]);
    if (this.archiveRoot) {
      await fs.promises.rm(this.archiveRoot, { force: true, recursive: true });
    }
  }

  private async archive(
    generation: ReviewGeneration,
  ): Promise<ReviewGeneration | undefined> {
    if (reviewDirectoryState(this.provider.outDir) === "missing") {
      this.generations.delete(generation.version);
      this.currentGeneration = undefined;
      return undefined;
    }
    const archiveRoot = await this.ensureArchiveRoot();
    if (reviewDirectoryState(this.provider.outDir) === "missing") {
      this.generations.delete(generation.version);
      this.currentGeneration = undefined;
      return undefined;
    }
    const archived = {
      directory: path.join(archiveRoot, generation.version),
      version: generation.version,
    };
    fs.renameSync(this.provider.outDir, archived.directory);
    this.currentGeneration = archived;
    this.generations.set(archived.version, archived);
    return archived;
  }

  private async ensureArchiveRoot(): Promise<string> {
    if (!this.archiveRoot) {
      await fs.promises.mkdir(path.dirname(this.provider.outDir), {
        recursive: true,
      });
      this.archiveRoot = await fs.promises.mkdtemp(
        path.join(path.dirname(this.provider.outDir), ".mokly-review-served-"),
      );
    }
    return this.archiveRoot;
  }

  private async restore(
    archived: ReviewGeneration,
    generationError: unknown,
  ): Promise<void> {
    try {
      if (reviewDirectoryState(this.provider.outDir) === "owned") {
        await fs.promises.rm(this.provider.outDir, {
          force: true,
          recursive: true,
        });
      }
      fs.renameSync(archived.directory, this.provider.outDir);
      const restored = {
        directory: path.resolve(this.provider.outDir),
        version: archived.version,
      };
      this.currentGeneration = restored;
      this.generations.set(restored.version, restored);
    } catch (restoreError) {
      throw new MoklyError(
        "server-failed",
        `Review generation failed (${errorMessage(generationError)}) and its ` +
          `previous artifact could not be restored: ${errorMessage(restoreError)}`,
        { cause: restoreError },
      );
    }
  }

  private scheduleExpiry(generation: ReviewGeneration): void {
    if (this.closed) return;
    const existing = this.retentionTimers.get(generation.version);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(
      () => this.expire(generation),
      GENERATION_RETENTION_MS,
    );
    timer.unref();
    this.retentionTimers.set(generation.version, timer);
  }

  private expire(generation: ReviewGeneration): void {
    this.retentionTimers.delete(generation.version);
    if (generation.version === this.currentGeneration?.version) return;
    this.generations.delete(generation.version);
    const removal = fs.promises.rm(generation.directory, {
      force: true,
      recursive: true,
    });
    this.removals.add(removal);
    void removal.then(
      () => this.removals.delete(removal),
      () => this.removals.delete(removal),
    );
  }
}

function reviewDirectoryState(directory: string): "missing" | "owned" {
  let output: fs.Stats;
  try {
    output = fs.lstatSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
  let marker: fs.Stats;
  try {
    marker = fs.lstatSync(path.join(directory, REVIEW_ARTIFACT_MARKER));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw unownedReviewDirectory(directory);
  }
  if (!output.isDirectory() || !marker.isFile()) {
    throw unownedReviewDirectory(directory);
  }
  return "owned";
}

function unownedReviewDirectory(directory: string): MoklyError {
  return new MoklyError(
    "review-invalid",
    `refusing to replace unowned Review directory: ${directory}`,
  );
}
