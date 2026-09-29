import assert from "node:assert/strict";
import test from "node:test";

import type { InteractiveSourceCapture } from "../dist/build/interactive_source_capture.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import {
  CachedInteractiveBundler,
  type InteractiveBundle,
  type InteractiveBundleCompiler,
  type InteractiveBundleRequest,
  type InteractiveBundler,
} from "../dist/interactive/bundle.js";
import { GenerationInteractiveBundles } from "../dist/interactive/bundle_state.js";

const config = {} as ResolvedConfig;
const sources: InteractiveSourceCapture = {
  files: [{ bytes: Buffer.from("source"), paths: ["entries/source.ts"] }],
};

test("evicting an in-flight cached compiler aborts its signal", async () => {
  const pending = new Map<
    AbortSignal,
    { reject(error: unknown): void; resolve(code: string): void }
  >();
  const signals: AbortSignal[] = [];
  const compiler: InteractiveBundleCompiler = {
    compile({ signal }) {
      signals.push(signal);
      return new Promise((resolve, reject) => {
        pending.set(signal, { reject, resolve });
        signal.addEventListener(
          "abort",
          () => reject(new Error("compiler aborted")),
          { once: true },
        );
      });
    },
  };
  const bundler = new CachedInteractiveBundler(compiler);
  const first = bundler.build({ config, generation: "a", sources });
  const rejected = assert.rejects(first, /compiler aborted/);
  const second = bundler.build({ config, generation: "b", sources });
  const third = bundler.build({ config, generation: "c", sources });

  assert.equal(signals[0]?.aborted, true);
  pending.get(signals[1]!)?.resolve("second");
  pending.get(signals[2]!)?.resolve("third");
  await rejected;
  assert.equal((await second).code, "second");
  assert.equal((await third).code, "third");
});

test("retired generation completions cannot publish stale state", async () => {
  const bundler = new ControlledBundler();
  const changes: string[] = [];
  const diagnostics: unknown[] = [];
  const service = new GenerationInteractiveBundles(
    bundler,
    (generation, state) => changes.push(`${generation}:${state}`),
    (error) => diagnostics.push(error),
  );
  service.adopt(config, "a", sources);
  service.start("a");
  await Promise.resolve();
  service.adopt(config, "b", sources);
  service.adopt(config, "c", sources);

  assert.deepEqual(bundler.invalidated, ["a"]);
  assert.equal(service.has("a"), false);
  assert.strictEqual(bundler.requests[0]?.sources, sources);
  bundler.resolve("a");
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(changes, ["a:building"]);
  assert.deepEqual(diagnostics, []);
});

class ControlledBundler implements InteractiveBundler {
  readonly invalidated: string[] = [];
  readonly requests: InteractiveBundleRequest[] = [];
  private readonly pending = new Map<
    string,
    (bundle: InteractiveBundle) => void
  >();

  build(request: InteractiveBundleRequest): Promise<InteractiveBundle> {
    this.requests.push(request);
    return new Promise((resolve) =>
      this.pending.set(request.generation, resolve),
    );
  }

  invalidate(generation: string): void {
    this.invalidated.push(generation);
  }

  resolve(generation: string): void {
    const resolve = this.pending.get(generation);
    if (!resolve) throw new Error(`No pending bundle for ${generation}`);
    resolve({ code: generation, generation });
  }
}
