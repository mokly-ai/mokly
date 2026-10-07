import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  VERIFICATION_OWNER_ID_ENV,
  VERIFICATION_RESOURCE_ROOT_ENV,
} from "../../dist/baseline/process_owner.js";
import { loadConfig } from "../../dist/config/load.js";

import {
  assertCleanExampleCache,
  exampleFingerprint,
  exampleRecipeIdentity,
  publishExampleDescriptor,
  readExampleDescriptor,
  SHARED_EXAMPLE_DESCRIPTOR_ENV,
  SHARED_EXAMPLE_DESCRIPTOR_NAME,
} from "./example_descriptor.js";
import type { ExampleDescriptor } from "./example_descriptor.js";
import {
  buildExampleBaseline,
  closeExampleAfterFailure,
  EXAMPLE_CATALOGUE_PATH,
  EXAMPLE_CONFIG_PATH,
  validateWarmExample,
} from "./example_preparation.js";
import type {
  ExamplePreparationOptions,
  PreparedExample,
} from "./example_preparation.js";
import { timeFixturePhase } from "./fixture_timing.js";
import { createOwnedExample } from "./owned_example.js";

export interface SharedExample extends PreparedExample {
  readonly descriptor: ExampleDescriptor;
  readonly descriptorPath: string;
}

/** Exactly one real rebuild, completed before an invocation publishes worker access. */
export async function prepareSharedExample(
  options: ExamplePreparationOptions = {},
): Promise<SharedExample> {
  const owned = await (options.createOwner ?? createOwnedExample)();
  try {
    const prepared = await owned.prepare(async (signal) => {
      const result = await buildExampleBaseline(
        owned,
        "browser-global",
        false,
        options.createSource,
      );
      await validateWarmExample(result.config, result.commit);
      await assertCleanExampleCache(owned.root, result.commit);
      const descriptor: ExampleDescriptor = {
        schemaVersion: 1,
        ownerId: owned.environment[VERIFICATION_OWNER_ID_ENV]!,
        repository: owned.root,
        commit: result.commit,
        configPath: EXAMPLE_CONFIG_PATH,
        cataloguePath: EXAMPLE_CATALOGUE_PATH,
        commands: result.config.review.baselineBuild!,
        recipeIdentity: exampleRecipeIdentity(
          result.config.review.baselineBuild!,
        ),
        templateHash: await exampleFingerprint(owned.root, signal),
      };
      const descriptorPath = path.join(
        owned.environment[VERIFICATION_RESOURCE_ROOT_ENV]!,
        SHARED_EXAMPLE_DESCRIPTOR_NAME,
      );
      await publishExampleDescriptor(descriptorPath, descriptor, signal);
      return { ...result, descriptor, descriptorPath };
    });
    let closing: Promise<void> | undefined;
    return {
      ...prepared,
      close() {
        closing ??= timeFixturePhase(
          "browser-global",
          "template-teardown",
          false,
          async () => {
            const failures: unknown[] = [];
            try {
              assert.equal(
                await exampleFingerprint(prepared.root),
                prepared.descriptor.templateHash,
                "The shared example template changed",
              );
            } catch (error) {
              failures.push(error);
            }
            await owned.close().catch((error: unknown) => {
              failures.push(error);
            });
            if (failures.length)
              throw new AggregateError(
                failures,
                "Shared example teardown failed",
              );
          },
        );
        return closing;
      },
    };
  } catch (error) {
    return closeExampleAfterFailure(owned, error);
  }
}

/** Each consumer gets its own repository and validated warm cache; never rebuild here. */
export async function acquireSharedExample(
  fixture: string,
  options: { environment?: NodeJS.ProcessEnv; signal?: AbortSignal } = {},
): Promise<PreparedExample> {
  const environment = options.environment ?? process.env;
  const descriptor = await readExampleDescriptor(environment);
  const owned = await createOwnedExample({
    environment,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  try {
    return await owned.prepare(async (signal) => {
      await timeFixturePhase(
        fixture,
        "template-validation",
        false,
        async () => {
          await assertCleanExampleCache(
            descriptor.repository,
            descriptor.commit,
          );
          assert.equal(
            await exampleFingerprint(descriptor.repository, signal),
            descriptor.templateHash,
            "The shared example template changed",
          );
          const original = await loadConfig(
            descriptor.repository,
            descriptor.configPath,
          );
          assert.equal(
            exampleRecipeIdentity(original.review.baselineBuild ?? []),
            descriptor.recipeIdentity,
          );
          await validateWarmExample(original, descriptor.commit);
        },
      );
      await timeFixturePhase(fixture, "copy", false, () =>
        fs.cp(descriptor.repository, owned.root, {
          recursive: true,
          force: false,
          errorOnExist: true,
          filter: () => {
            signal.throwIfAborted();
            return true;
          },
        }),
      );
      const config = await loadConfig(owned.root, descriptor.configPath);
      await timeFixturePhase(fixture, "cache-validation", false, async () => {
        assert.equal(
          exampleRecipeIdentity(config.review.baselineBuild ?? []),
          descriptor.recipeIdentity,
        );
        await assertCleanExampleCache(owned.root, descriptor.commit);
        await validateWarmExample(config, descriptor.commit);
        assert.equal(
          await exampleFingerprint(descriptor.repository, signal),
          descriptor.templateHash,
          "The shared example template changed during copy",
        );
      });
      return { ...owned, config, commit: descriptor.commit };
    });
  } catch (error) {
    return closeExampleAfterFailure(owned, error);
  }
}

/** Publish only this validated capability through Playwright's worker environment. */
export function sharedExampleEnvironment(
  shared: SharedExample,
): NodeJS.ProcessEnv {
  return {
    ...shared.environment,
    [SHARED_EXAMPLE_DESCRIPTOR_ENV]: shared.descriptorPath,
  };
}
