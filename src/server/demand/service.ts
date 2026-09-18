/** One foreground worker with coalesced requests and a bounded validated-document cache. */
import type { EventEmitter } from "node:events";
import { Worker } from "node:worker_threads";

import { generatedViews } from "@mokly/viewer/data";

import { compactRuntime } from "../../build/compact_runtime.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import { DocumentCache } from "../../build/document_cache.js";
import type { CompiledDocument } from "../../build/document_compiler.js";
import { timeAsync } from "../../diagnostics/timings.js";
import { MoklyError } from "../../errors.js";

interface Job {
  route: string;
  resolve(document: CompiledDocument): void;
  reject(error: unknown): void;
}
export type DocumentWorker = Pick<EventEmitter, "on" | "off"> &
  Pick<Worker, "postMessage" | "terminate">;
export interface DocumentServiceOptions {
  createWorker?: () => DocumentWorker;
  timeoutMs?: number;
  maxQueued?: number;
  onDocument?: (document: CompiledDocument) => void;
}
export class DocumentService {
  readonly generation: string;
  readonly routes: ReadonlySet<string>;
  private readonly cache = new DocumentCache<CompiledDocument>(
    64 * 1024 * 1024,
    (value) => Buffer.byteLength(JSON.stringify(value)),
  );
  private readonly pending: Job[] = [];
  private readonly inFlight = new Map<string, Promise<CompiledDocument>>();
  private worker: DocumentWorker | undefined;
  private active: Job | undefined;
  private closed = false;
  private working = false;
  private readonly terminating = new Set<Promise<void>>();
  private failActive: ((error: unknown) => void) | undefined;
  private readonly runtime: ComponentRuntime;

  constructor(
    runtime: ComponentRuntime,
    private readonly busy: (value: boolean) => void = () => {},
    private readonly options: DocumentServiceOptions = {},
  ) {
    this.runtime = compactRuntime(runtime);
    this.generation = runtime.generation;
    this.routes = new Set(
      runtime.manifest.entries.flatMap((entry) =>
        entry.kind === "page"
          ? [entry.route]
          : generatedViews(entry).map((view) => view.path),
      ),
    );
  }

  read(route: string): Promise<CompiledDocument> {
    if (this.closed)
      return Promise.reject(new Error("Preview service is closed"));
    if (!this.routes.has(route))
      return Promise.reject(new Error("Unknown preview"));
    const cached = this.cache.get(route);
    if (cached) return Promise.resolve(cached);
    const pending = this.inFlight.get(route);
    if (pending) return pending;
    if (this.pending.length >= (this.options.maxQueued ?? 32))
      return Promise.reject(
        new Error("The preview renderer is busy. Try again shortly."),
      );
    const result = timeAsync(
      "preview.render",
      () =>
        new Promise<CompiledDocument>((resolve, reject) => {
          this.pending.push({ route, resolve, reject });
          this.setBusy(true);
          this.drain();
        }),
    ).finally(() => this.inFlight.delete(route));
    this.inFlight.set(route, result);
    return result;
  }

  async close(): Promise<void> {
    this.closed = true;
    const error = new Error("Preview service stopped");
    for (const job of this.pending.splice(0)) job.reject(error);
    this.failActive?.(error);
    if (this.worker) this.terminate(this.worker);
    await Promise.all(this.terminating);
    this.worker = undefined;
    this.cache.clear();
    this.setBusy(false);
  }

  private setBusy(active: boolean): void {
    if (this.working === active) return;
    this.working = active;
    this.busy(active);
  }

  private terminate(worker: DocumentWorker): Promise<void> {
    const done = worker
      .terminate()
      .then(
        () => {},
        () => {},
      )
      .finally(() => this.terminating.delete(done));
    this.terminating.add(done);
    return done;
  }

  private createWorker(): DocumentWorker {
    const worker =
      this.options.createWorker?.() ??
      new Worker(new URL("./worker.js", import.meta.url), {
        workerData: this.runtime,
        execArgv: [],
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
    const failed = (error: unknown) => {
      if (this.worker !== worker) return;
      this.worker = undefined;
      if (this.failActive) this.failActive(error);
      else void this.terminate(worker).then(() => this.drain());
    };
    worker.on("error", failed);
    worker.on("exit", () =>
      failed(new Error("The preview renderer stopped. Try again.")),
    );
    return worker;
  }

  private drain(): void {
    if (this.closed || this.active || this.terminating.size) return;
    const job = this.pending.shift();
    if (!job) {
      this.setBusy(false);
      return;
    }
    this.active = job;
    let worker: DocumentWorker;
    try {
      worker = this.worker ??= this.createWorker();
    } catch (error) {
      this.active = undefined;
      job.reject(error);
      this.drain();
      return;
    }
    let settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timer);
      worker.off("message", message);
      this.active = undefined;
      this.failActive = undefined;
    };
    const failed = (error: unknown) => {
      if (settled) return;
      finish();
      this.worker = undefined;
      job.reject(error);
      void this.terminate(worker).then(() => this.drain());
    };
    const message = (value: {
      ok: boolean;
      document?: CompiledDocument;
      error?: string;
    }) => {
      if (settled) return;
      if (!value.ok || !value.document)
        return failed(
          new MoklyError(
            "build-invalid",
            value.error ?? "Could not render preview",
          ),
        );
      finish();
      this.cache.set(job.route, value.document);
      this.options.onDocument?.(value.document);
      job.resolve(value.document);
      this.drain();
    };
    const timer = setTimeout(
      () => failed(new Error("The preview took too long. Try again.")),
      this.options.timeoutMs ?? 10_000,
    );
    this.failActive = failed;
    worker.on("message", message);
    try {
      worker.postMessage(job.route);
    } catch (error) {
      failed(error);
    }
  }
}
