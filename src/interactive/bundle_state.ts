/** Generation-scoped browser-bundle readiness and retention. */

import type { ViewerInteractiveDescriptor } from "@mokly/viewer/runtime";

import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import type { InteractiveBundler } from "./bundle.js";

type BundleState = ViewerInteractiveDescriptor["state"];
/** Stable failure classification used by both HTTP origins. */
export type InteractiveBundleFailure = "bundle" | "internal";

interface GenerationRecord {
  code?: string;
  config: ResolvedConfig;
  failure?: InteractiveBundleFailure;
  generation: string;
  pending?: Promise<void>;
  state: BundleState;
}

/** Result of awaiting the current generation's one retained build. */
export interface InteractiveBundlePreparation {
  failure?: InteractiveBundleFailure;
  state: "failed" | "ready";
}

/** Stateful behavior boundary used by both app and interactive listeners. */
export interface InteractiveBundleService {
  adopt(config: ResolvedConfig, generation: string): void;
  code(generation: string): string | undefined;
  failure(generation: string): InteractiveBundleFailure | undefined;
  has(generation: string): boolean;
  prepare(generation: string): Promise<InteractiveBundlePreparation>;
  start(generation: string): BundleState | undefined;
  state(generation: string): BundleState | undefined;
}

/** Retain current and previous states while delegating byte caching to the bundler. */
export class GenerationInteractiveBundles implements InteractiveBundleService {
  private readonly generations = new Map<string, GenerationRecord>();

  constructor(
    private readonly bundler: InteractiveBundler,
    private readonly changed: (generation: string, state: BundleState) => void,
    private readonly diagnostic: (error: unknown) => void,
  ) {}

  adopt(config: ResolvedConfig, generation: string): void {
    if (!this.generations.has(generation))
      this.generations.set(generation, {
        config,
        generation,
        state: "idle",
      });
    while (this.generations.size > 2) {
      const oldest = this.generations.keys().next().value as string | undefined;
      if (!oldest) break;
      this.generations.delete(oldest);
      this.bundler.invalidate(oldest);
    }
  }

  code(generation: string): string | undefined {
    return this.generations.get(generation)?.code;
  }

  failure(generation: string): InteractiveBundleFailure | undefined {
    return this.generations.get(generation)?.failure;
  }

  has(generation: string): boolean {
    return this.generations.has(generation);
  }

  async prepare(generation: string): Promise<InteractiveBundlePreparation> {
    const record = this.generations.get(generation);
    if (!record) return { failure: "internal", state: "failed" };
    this.start(generation);
    await record.pending;
    return record.state === "ready"
      ? { state: "ready" }
      : { failure: record.failure ?? "internal", state: "failed" };
  }

  start(generation: string): BundleState | undefined {
    const record = this.generations.get(generation);
    if (!record || record.state !== "idle") return record?.state;
    record.state = "building";
    this.changed(generation, record.state);
    record.pending = timeAsync("interactive.bundle", () =>
      Promise.resolve().then(() =>
        this.bundler.build({ config: record.config, generation }),
      ),
    ).then(
      (bundle) => {
        if (bundle.generation !== generation)
          return this.fail(
            record,
            new Error("Live bundle generation did not match its request"),
          );
        record.code = bundle.code;
        record.state = "ready";
        this.changed(generation, record.state);
      },
      (error) => this.fail(record, error),
    );
    return record.state;
  }

  state(generation: string): BundleState | undefined {
    return this.generations.get(generation)?.state;
  }

  private fail(record: GenerationRecord, error: unknown): void {
    record.failure =
      error instanceof MoklyError && error.code === "interactive-bundle"
        ? "bundle"
        : "internal";
    record.state = "failed";
    this.diagnostic(error);
    this.changed(record.generation, record.state);
  }
}
