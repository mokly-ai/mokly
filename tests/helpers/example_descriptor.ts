import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { canonicalJson } from "@mokly/viewer/data";

import {
  cacheLayout,
  validCommands,
} from "../../dist/baseline/cache_layout.js";
import {
  VERIFICATION_OWNER_ID_ENV,
  VERIFICATION_RESOURCE_ROOT_ENV,
} from "../../dist/baseline/process_owner.js";

import {
  EXAMPLE_CATALOGUE_PATH,
  EXAMPLE_CONFIG_PATH,
} from "./example_preparation.js";
import { repositoryRoot } from "./fixture.js";

export const SHARED_EXAMPLE_DESCRIPTOR_ENV =
  "MOKLY_BROWSER_BASELINE_DESCRIPTOR";
export const SHARED_EXAMPLE_DESCRIPTOR_NAME = "example-baseline.json";

/** The explicit per-invocation capability delivered to each Playwright worker. */
export interface ExampleDescriptor {
  readonly schemaVersion: 1;
  readonly ownerId: string;
  readonly repository: string;
  readonly commit: string;
  readonly configPath: typeof EXAMPLE_CONFIG_PATH;
  readonly cataloguePath: typeof EXAMPLE_CATALOGUE_PATH;
  readonly commands: readonly (readonly string[])[];
  readonly recipeIdentity: string;
  readonly templateHash: string;
}

/** Commands and requested paths stay invariant when a repository copy moves. */
export function exampleRecipeIdentity(
  commands: readonly (readonly string[])[],
): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        configPath: EXAMPLE_CONFIG_PATH,
        cataloguePath: EXAMPLE_CATALOGUE_PATH,
        commands,
      }),
    )
    .digest("hex");
}

/** Publish only completed, validated preparation through an atomic descriptor rename. */
export async function publishExampleDescriptor(
  file: string,
  descriptor: ExampleDescriptor,
  signal: AbortSignal,
): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  signal.throwIfAborted();
  await fs.writeFile(temporary, `${JSON.stringify(descriptor)}\n`, {
    flag: "wx",
    signal,
  });
  signal.throwIfAborted();
  await fs.rename(temporary, file);
}

/** No newest-directory search, missing-descriptor fallback or cross-invocation adoption. */
export async function readExampleDescriptor(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ExampleDescriptor> {
  const resources = environment[VERIFICATION_RESOURCE_ROOT_ENV];
  const file = environment[SHARED_EXAMPLE_DESCRIPTOR_ENV];
  const ownerId = environment[VERIFICATION_OWNER_ID_ENV];
  const context = path.join(repositoryRoot, ".context");
  if (
    !resources ||
    !ownerId ||
    !file ||
    !resources.startsWith(`${context}${path.sep}`) ||
    path.resolve(resources) !== resources ||
    file !== path.join(resources, SHARED_EXAMPLE_DESCRIPTOR_NAME)
  )
    throw new Error("The browser baseline was not prepared by this invocation");
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024)
    throw new Error("Invalid shared example descriptor file");
  const value: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  const keys = [
    "schemaVersion",
    "ownerId",
    "repository",
    "commit",
    "configPath",
    "cataloguePath",
    "commands",
    "recipeIdentity",
    "templateHash",
  ];
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  )
    throw new Error("Invalid shared example descriptor");
  const descriptor = value as ExampleDescriptor;
  if (
    descriptor.schemaVersion !== 1 ||
    descriptor.ownerId !== ownerId ||
    descriptor.repository !== path.join(resources, "repository") ||
    typeof descriptor.commit !== "string" ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(descriptor.commit) ||
    descriptor.configPath !== EXAMPLE_CONFIG_PATH ||
    descriptor.cataloguePath !== EXAMPLE_CATALOGUE_PATH ||
    !validCommands(descriptor.commands) ||
    descriptor.commands.length === 0 ||
    descriptor.recipeIdentity !== exampleRecipeIdentity(descriptor.commands) ||
    typeof descriptor.templateHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(descriptor.templateHash)
  )
    throw new Error("Mismatched shared example descriptor");
  if (
    (await fs.realpath(resources)) !== resources ||
    (await fs.realpath(descriptor.repository)) !== descriptor.repository
  )
    throw new Error("Shared example ownership must not use directory aliases");
  return descriptor;
}

/** Content, Git refs/index and completed cache bytes form an immutable template. */
export async function exampleFingerprint(
  root: string,
  signal?: AbortSignal,
): Promise<string> {
  const hash = createHash("sha256");
  const visit = async (relative: string): Promise<void> => {
    signal?.throwIfAborted();
    const file = path.join(root, relative);
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink())
      throw new Error(`Shared example contains a symlink: ${relative}`);
    if (stat.isDirectory()) {
      hash.update(`directory:${relative}\0`);
      for (const name of (await fs.readdir(file)).sort())
        await visit(path.posix.join(relative, name));
    } else if (stat.isFile()) {
      hash.update(`file:${relative}\0${stat.size}\0`);
      hash.update(await fs.readFile(file, signal ? { signal } : {}));
    } else
      throw new Error(`Shared example contains a special file: ${relative}`);
  };
  await visit("");
  return hash.digest("hex");
}

/** Never copy live locks, partial extraction or incomplete transaction debris. */
export async function assertCleanExampleCache(
  root: string,
  commit: string,
): Promise<void> {
  const layout = cacheLayout(root, commit);
  assert.deepEqual((await fs.readdir(layout.root)).sort(), [commit]);
  assert.deepEqual((await fs.readdir(layout.entry)).sort(), [
    "complete.json",
    "inputs.json",
    "output",
  ]);
}
