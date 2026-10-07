import fs from "node:fs/promises";
import path from "node:path";

import { NodeBaselineProcessRunner } from "../../dist/baseline/process.js";
import {
  InheritedProcessOwnerRegistrar,
  VERIFICATION_RESOURCE_ROOT_ENV,
} from "../../dist/baseline/process_owner.js";
import { NodeBaselineProcessScopeFactory } from "../../dist/baseline/process_scope.js";
import { createVerificationProcessOwner } from "../../scripts/verification/process-owner.mjs";

import { repositoryRoot } from "./fixture.js";
import { FULL_CATALOGUE_SETUP_TIMEOUT_MS } from "./fixture_timing.js";

export interface OwnedExample {
  readonly root: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly runner: NodeBaselineProcessRunner;
  readonly signal: AbortSignal;
  prepare<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** One bounded preparation and its process/resource owner, independent of other invocations. */
export async function createOwnedExample(
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    environment?: NodeJS.ProcessEnv;
  } = {},
): Promise<OwnedExample> {
  const owner = await createVerificationProcessOwner({
    cwd: repositoryRoot,
    env: options.environment ?? process.env,
  });
  const environment = owner.environment(options.environment ?? process.env);
  const resources = environment[VERIFICATION_RESOURCE_ROOT_ENV]!;
  const context = path.join(repositoryRoot, ".context");
  if (!resources.startsWith(`${context}${path.sep}`)) {
    await owner.dispose();
    throw new Error("Example verification resources must stay under .context");
  }
  const root = path.join(resources, "repository");
  const controller = new AbortController();
  const active = new Set<Promise<unknown>>();
  let closing: Promise<void> | undefined;
  let termination: Promise<void> = Promise.resolve();
  const abort = () => {
    controller.abort(
      options.signal?.reason ?? new Error("Example preparation cancelled"),
    );
    termination = termination.then(() => owner.terminate("SIGTERM"));
    void termination.catch(() => {});
  };
  process.on("SIGINT", abort);
  process.on("SIGTERM", abort);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const runner = new NodeBaselineProcessRunner(
    undefined,
    new NodeBaselineProcessScopeFactory(
      new InheritedProcessOwnerRegistrar(environment),
    ),
  );
  const result: OwnedExample = {
    root,
    environment,
    runner,
    signal: controller.signal,
    prepare<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
      const timer = setTimeout(
        abort,
        options.timeoutMs ?? FULL_CATALOGUE_SETUP_TIMEOUT_MS,
      );
      const pending = Promise.resolve()
        .then(async () => {
          controller.signal.throwIfAborted();
          const value = await operation(controller.signal);
          controller.signal.throwIfAborted();
          return value;
        })
        .finally(() => {
          clearTimeout(timer);
          active.delete(pending);
        });
      active.add(pending);
      return pending;
    },
    close() {
      closing ??= (async () => {
        controller.abort(new Error("Example owner closed"));
        await Promise.allSettled([...active]);
        const failures: unknown[] = [];
        try {
          await termination;
        } catch (error) {
          failures.push(error);
        }
        try {
          await owner.dispose();
        } catch (error) {
          failures.push(error);
        }
        process.removeListener("SIGINT", abort);
        process.removeListener("SIGTERM", abort);
        options.signal?.removeEventListener("abort", abort);
        if (failures.length)
          throw new AggregateError(failures, "Example owner cleanup failed");
      })();
      return closing;
    },
  };
  try {
    await fs.mkdir(root);
    return result;
  } catch (error) {
    await result.close();
    throw error;
  }
}
