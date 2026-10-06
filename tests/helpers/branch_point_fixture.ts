import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type { Compilation } from "../../packages/mokly/dist/build/compile.js";
import { writeCompilation } from "../../packages/mokly/dist/build/transaction.js";
import { ConfiguredGitCommandRunner } from "../../packages/mokly/dist/config/git.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";
import { CommittedRepository } from "../../packages/mokly/dist/review/git.js";

import {
  branchPointSources,
  type BranchPointCase,
} from "./branch_point_sources.js";
import { commitMoveBaseline } from "./move_delivery.js";
import { pathFixture } from "./path_fixture.js";

/** Structurally accepted by the browser branch hosts, with node evidence too. */
export interface BranchPointFixture {
  config: ResolvedConfig;
  fixture: Awaited<ReturnType<typeof pathFixture>>;
  before: Compilation;
  after: Compilation;
  git: CommittedRepository;
}

/**
 * Commit one real baseline as main and origin/main, then apply its head edits.
 * The caller owns cleanup; no browser or test-runner API is required here.
 */
export async function branchPointFixture(
  name: BranchPointCase,
): Promise<BranchPointFixture> {
  const sources = branchPointSources(name);
  const fixture = await pathFixture(
    sources.before,
    '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light","dark"]}',
  );
  try {
    await fs.mkdir(path.join(fixture.root, "mockups"));
    const before = await fixture.compile();
    await commitMoveBaseline(await fixture.config(), before);
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], {
      cwd: fixture.root,
      stdio: "pipe",
    });
    for (const [file, content] of Object.entries(sources.head)) {
      if (content === null) await fs.rm(path.join(fixture.root, file));
      else await fixture.write(file, content);
    }
    const config = await fixture.config();
    const after = await fixture.compile();
    await writeCompilation(after, config);
    return {
      fixture,
      config,
      before,
      after,
      git: new CommittedRepository(new ConfiguredGitCommandRunner(config)),
    };
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}
