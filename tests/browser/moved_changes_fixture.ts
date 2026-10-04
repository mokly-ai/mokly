import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { Page } from "@playwright/test";

import { readCatalogue } from "@mokly/viewer";

import { writeCompilation } from "../../dist/build/transaction.js";
import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";
import { pathFixture } from "../helpers/path_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

import { BASELINE, MOVED_EDITS } from "./moved_changes_sources.js";
import { hostExportedViewer } from "./viewer_host.js";

/** Where the moved catalogue runs: Serve, a static export, or an embedded viewer over that export. */
export type MovedHostKind = "serve" | "export" | "viewer";

/** A running moved catalogue and how a test opens one of its entries. */
export interface MovedChangesHost {
  url: string;
  open(page: Page, entry: string): Promise<void>;
  close(): Promise<void>;
}

async function waitForChanges(url: string): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt++) {
    const model = readCatalogue(
      await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
    );
    if (model.changesStatus === "ready") return;
    await delay(50);
  }
  throw new Error("The fixture did not publish its moved entries");
}

/**
 * Commit the baseline from `moved_changes_sources.ts`, then move `billing`
 * under `account` and rename `components` to `ui`, and apply the branch's
 * edits there.
 */
async function movedCatalogue() {
  const fixture = await pathFixture(
    BASELINE,
    '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light"]}',
  );
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
    git("commit", "-qm", "test: move baseline");
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
    const specs = path.join(fixture.root, "specs");
    await fs.mkdir(path.join(specs, "account"));
    await fs.rename(
      path.join(specs, "billing"),
      path.join(specs, "account/billing"),
    );
    await fs.rename(path.join(specs, "components"), path.join(specs, "ui"));
    for (const [file, source] of Object.entries(MOVED_EDITS))
      await fixture.write(file, source);
    const config = await fixture.config();
    await writeCompilation(await fixture.compile(), config);
    return { config, fixture };
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}

/** A host whose entries open at their shell URLs. */
function shellHost(url: string, close: () => Promise<void>): MovedChangesHost {
  return {
    url,
    open: async (page, entry) => {
      await page.goto(`${url}/view/${entry}/`);
    },
    close,
  };
}

/** Serve the moved catalogue in development. */
async function serveMoved(): Promise<MovedChangesHost> {
  const { config, fixture } = await movedCatalogue();
  try {
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
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}

/**
 * Export the moved catalogue, then serve it as ordinary files, or mount the
 * embedded viewer over its catalogue with entries opened by query.
 */
async function exportMoved(viewer: boolean): Promise<MovedChangesHost> {
  const { config, fixture } = await movedCatalogue();
  try {
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
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}

/** Start the moved catalogue on one kind of host. */
export function startMovedHost(kind: MovedHostKind): Promise<MovedChangesHost> {
  return kind === "serve" ? serveMoved() : exportMoved(kind === "viewer");
}
