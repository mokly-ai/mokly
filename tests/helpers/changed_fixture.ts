import { execFileSync } from "node:child_process";
import type { TestContext } from "node:test";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  type TestFixture,
  validEntrySource,
} from "./fixture.js";

/** Build a committed consumer; register live resources with onCleanup before using it. */
export async function changedFixture(
  t: TestContext,
  source = validEntrySource(),
  options?: Parameters<typeof createFixture>[1],
  prepare?: (fixture: TestFixture) => Promise<void>,
) {
  const fixture = await createFixture(source, options);
  const resources: (() => Promise<void>)[] = [];
  t.after(async () => {
    const failures: unknown[] = [];
    for (const close of resources.toReversed()) {
      try {
        await close();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "Fixture resources could not close");
    await removeFixture(fixture);
  });
  await prepare?.(fixture);
  const config = await loadConfig(fixture.root);
  const build = async () =>
    writeCompilation(await compileCatalogue(config), config);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" });
  await build();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  git("add", ".");
  git("commit", "-qm", "test: catalogue baseline");
  return {
    ...fixture,
    build,
    config,
    git,
    onCleanup(close: () => Promise<void>): void {
      resources.push(close);
    },
  };
}
