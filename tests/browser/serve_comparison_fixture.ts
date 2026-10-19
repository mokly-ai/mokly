import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import {
  addBranchPointSources,
  branchPointPaths,
} from "../helpers/branch_point_sources.js";
import {
  comparisonPaths,
  createComparisonCatalogue,
} from "../helpers/comparison_catalogue.js";
import { repositoryRoot } from "../helpers/fixture.js";
import {
  ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS,
  timeFixturePhase,
} from "../helpers/fixture_timing.js";
import { git, write } from "../helpers/static_changes.js";

import { serveHost, type BrowserHost } from "./hosts.js";

/** Real, private Changes state for viewer specs; no checkout history or mock data. */
export async function serveComparisonCatalogue() {
  const root = await fs.mkdtemp(
    path.join(
      process.env["MOKLY_VERIFICATION_RESOURCE_ROOT"] ??
        path.join(repositoryRoot, ".context"),
      "serve-comparison-",
    ),
  );
  const abort = new AbortController();
  let host: BrowserHost | undefined;
  let starting: Promise<BrowserHost> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      abort.abort();
      const active = host ?? (await starting?.catch(() => undefined));
      await active?.close();
      await fs.rm(root, { recursive: true, force: true });
    })());
  ownBrowserCleanup(close);
  try {
    await createComparisonCatalogue(root, addBranchPointSources);
    const baseCommit = await git(root, "rev-parse", "fixture-base");
    const headCommit = await git(root, "rev-parse", "HEAD");
    const signal = AbortSignal.any([
      abort.signal,
      AbortSignal.timeout(ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS),
    ]);
    starting = serveHost(
      [
        path.join(repositoryRoot, "packages/mokly/bin/mokly.mjs"),
        "serve",
        "--port",
        "0",
        "--sidecars",
        "1",
      ],
      root,
      signal,
    );
    host = await starting;
    const url = host.url;
    const index = async (): Promise<CatalogueReadModel> => {
      const response = await fetch(`${url}/mokly-viewer/index.json`);
      if (!response.ok) throw new Error(`Catalogue index: ${response.status}`);
      return readCatalogueIndex(await response.json());
    };
    const ready = async (after = 0, expectedBase?: string) => {
      let accepted: Awaited<ReturnType<typeof index>> | undefined;
      try {
        await expect
          .poll(
            async () => {
              const current = await index();
              if (
                current.revision <= after ||
                current.changesStatus !== "ready"
              )
                return false;
              if (expectedBase) {
                const review = await fetch(
                  new URL(current.comparisonUrl!, url),
                );
                if ((await review.json()).baseCommit !== expectedBase)
                  return false;
              }
              accepted = current;
              return true;
            },
            { timeout: 30_000 },
          )
          .toBe(true);
      } catch (cause) {
        throw new Error(
          `Serve comparison did not become ready:\n${host?.diagnostics?.()}`,
          { cause },
        );
      }
      return accepted!;
    };
    await timeFixturePhase(
      "browser-serve-comparison",
      "changes-readiness",
      false,
      () => ready(0, baseCommit),
    );
    return {
      root,
      url,
      close,
      index,
      ready,
      baseCommit,
      headCommit,
      paths: { ...comparisonPaths, ...branchPointPaths },
      /** One watched source write, followed by its accepted Changes publication. */
      async edit(name: string, contents: string) {
        const previous = await index();
        await write(root, name, contents);
        return ready(previous.revision);
      },
      /** Move only the private base ref; the working catalogue and HEAD stay fixed. */
      async moveBase(side: "base" | "head") {
        const previous = await index();
        const commit = side === "base" ? baseCommit : headCommit;
        await git(root, "update-ref", "refs/heads/fixture-base", commit);
        return ready(previous.revision, commit);
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
