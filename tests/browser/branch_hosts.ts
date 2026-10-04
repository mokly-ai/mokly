/**
 * Git-backed catalogues for browser tests: a committed branch point, the
 * branch's edits on top, and the host that runs the result.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { Page } from "@playwright/test";

import { readCatalogue } from "@mokly/viewer";

import { writeCompilation } from "../../dist/build/transaction.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";
import { pathFixture } from "../helpers/path_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { hostExportedViewer } from "./viewer_host.js";

/** Where a branch catalogue runs: Serve, a static export, or an embedded viewer over that export. */
export type BranchHostKind = "serve" | "export" | "viewer";

/** A running branch catalogue and how a test opens one of its entries. */
export interface BranchHost {
  url: string;
  open(page: Page, entry: string): Promise<void>;
  close(): Promise<void>;
}

type PathFixture = Awaited<ReturnType<typeof pathFixture>>;

/** A compiled branch catalogue; the host that runs it removes it. */
export interface BranchCatalogue {
  config: ResolvedConfig;
  fixture: PathFixture;
}

/**
 * Compile `files` and commit them as `origin/main`, then apply `branch` and
 * compile again, so Changes compares the branch with that branch point. The
 * config writes generated output to `mockups`.
 */
export async function branchCatalogue(
  files: Readonly<Record<string, string>>,
  config: string,
  branch: (fixture: PathFixture) => Promise<void>,
): Promise<BranchCatalogue> {
  const fixture = await pathFixture(files, config);
  try {
    await fs.mkdir(path.join(fixture.root, "mockups"));
    await writeCompilation(await fixture.compile(), await fixture.config());
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" })
        .toString()
        .trim();
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Mokly Test");
    git("config", "user.email", "mokly@example.invalid");
    git("add", "-A");
    git("commit", "-qm", "test: branch point");
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
    await branch(fixture);
    const resolved = await fixture.config();
    await writeCompilation(await fixture.compile(), resolved);
    return { config: resolved, fixture };
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}

async function waitForChanges(url: string): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt++) {
    const model = readCatalogue(
      await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
    );
    if (model.changesStatus === "ready") return;
    await delay(50);
  }
  throw new Error("The branch catalogue did not publish its Changes");
}

/** A host whose entries open at their shell URLs. */
function shellHost(url: string, close: () => Promise<void>): BranchHost {
  return {
    url,
    open: async (page, entry) => {
      await page.goto(`${url}/view/${entry}/`);
    },
    close,
  };
}

/** Serve the branch catalogue in development, once its Changes are ready. */
async function serveBranch({
  config,
  fixture,
}: BranchCatalogue): Promise<BranchHost> {
  const running = await serve(config, {
    base: "origin/main",
    port: 0,
    watch: false,
  });
  try {
    await waitForChanges(running.url);
  } catch (error) {
    await running.close();
    throw error;
  }
  return shellHost(running.url, async () => {
    await running.close();
    await fixture.remove();
  });
}

/**
 * Export the branch catalogue, then serve it as ordinary files, or mount the
 * embedded viewer over its catalogue with entries opened by query.
 */
async function exportBranch(
  { config, fixture }: BranchCatalogue,
  viewer: boolean,
): Promise<BranchHost> {
  await exportCatalogue(config, { base: "origin/main", outDir: "site" });
  const site = path.join(fixture.root, "site");
  if (!viewer) {
    const server = await serveStaticFiles(site);
    return shellHost(server.url, async () => {
      await server.close();
      await fixture.remove();
    });
  }
  const hosted = await hostExportedViewer(site);
  return {
    url: hosted.url,
    open: async (page, entry) => {
      await page.goto(`${hosted.url}/viewer.html?view=all&entry=${entry}`);
    },
    close: async () => {
      await hosted.close();
      await fixture.remove();
    },
  };
}

/** Run a branch catalogue on one kind of host, which removes it on close. */
export async function startBranchHost(
  kind: BranchHostKind,
  catalogue: () => Promise<BranchCatalogue>,
): Promise<BranchHost> {
  const built = await catalogue();
  try {
    return kind === "serve"
      ? await serveBranch(built)
      : await exportBranch(built, kind === "viewer");
  } catch (error) {
    await built.fixture.remove();
    throw error;
  }
}
