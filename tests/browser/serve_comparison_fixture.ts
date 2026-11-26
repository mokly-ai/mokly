import fs from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import type { CatalogueReadModel } from "@mokly/viewer";

import { readCatalogueIndex } from "../../packages/viewer/src/catalogue/index_reader.js";
import { ownBrowserCleanup } from "../../packages/viewer/tests/browser_cleanup.js";
import { addComparisonFixtureSources } from "../helpers/additional_comparison_sources.js";
import { branchPointPaths } from "../helpers/branch_point_sources.js";
import {
  comparisonPaths,
  createComparisonCatalogue,
  type ComparisonAdditions,
} from "../helpers/comparison_catalogue.js";
import { startDuration } from "../helpers/durations.js";
import { repositoryRoot } from "../helpers/fixture.js";
import {
  ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS,
  timeFixturePhase,
} from "../helpers/fixture_timing.js";
import { movedFixturePaths } from "../helpers/moved_fixture_sources.js";
import { git, write } from "../helpers/static_changes.js";

import { serveHost, type BrowserHost } from "./hosts.js";
import { commitBaseSources } from "./serve_comparison_git.js";

/**
 * The waits between index reads while a publication is pending. A watched
 * edit publishes after a rebuild and a classification, and the default
 * backoff of `expect.poll` waits up to one second between reads. Playwright
 * consumes the array that it receives, so each wait passes a copy.
 */
const PUBLICATION_POLL_INTERVALS: readonly number[] = [50, 100, 200];

/** A caller's semantic state, beyond the publication counter and Changes status. */
export type ReadyPredicate = (
  index: CatalogueReadModel,
) => boolean | Promise<boolean>;

/**
 * The duration of one wait and the states that it read, oldest first, for
 * the report of a wait that failed. The test's own time limit can end a
 * wait before its 30-second poll does, with the same error.
 */
function readLog() {
  const elapsed = startDuration();
  const states: { state: string; reads: number }[] = [];
  let inFlight = false;
  const record = (state: string) => {
    const last = states.at(-1);
    if (last?.state === state) last.reads += 1;
    else states.push({ state, reads: 1 });
  };
  return {
    record,
    /** Track one index read, so that a read without a response shows. */
    async read(pending: Promise<CatalogueReadModel>) {
      inFlight = true;
      try {
        return await pending;
      } catch (error) {
        record(`read failed: ${String(error)}`);
        throw error;
      } finally {
        inFlight = false;
      }
    },
    report: () =>
      [
        `The wait ended after ${elapsed()}. The cause below names the limit that ended it: the 30-second poll or the test's time limit. Index reads, oldest first:`,
        ...states.map(({ state, reads }) => `- ${state} (${reads} reads)`),
        ...(states.length === 0 ? ["- no index read completed"] : []),
        ...(inFlight ? ["- the last index read had no response"] : []),
      ].join("\n"),
  };
}

/** One index read as the report of a wait names it. */
function describeRead(index: CatalogueReadModel, predicate?: boolean) {
  return [
    `revision ${index.revision}`,
    `changesStatus ${index.changesStatus}`,
    ...(index.baseCommit ? [`baseCommit ${index.baseCommit}`] : []),
    ...(predicate === undefined ? [] : [`predicate ${predicate}`]),
  ].join(", ");
}

/** Replace one source atomically without placing a partial file in a watched root. */
async function replaceSource(root: string, name: string, contents: string) {
  const file = path.join(root, name);
  const previous = await fs
    .readFile(file, "utf8")
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return undefined;
    });
  if (previous === contents)
    throw new Error(`Unchanged fixture source: ${name}`);
  await fs.mkdir(path.join(root, ".context"), { recursive: true });
  const temporary = await fs.mkdtemp(path.join(root, ".context", "edit-"));
  try {
    await write(temporary, "source", contents);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.rename(path.join(temporary, "source"), file);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

/**
 * Real, private Changes state for viewer specs; no checkout history or mock
 * data. `additions` adds a spec's own sources after the shared hooks.
 */
export async function serveComparisonCatalogue(
  additions?: ComparisonAdditions,
) {
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
    await createComparisonCatalogue(root, async (directory, side) => {
      await addComparisonFixtureSources(directory, side);
      await additions?.(directory, side);
    });
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
    const ready = async (
      after = 0,
      expectedBase?: string,
      predicate?: ReadyPredicate,
    ): Promise<CatalogueReadModel> => {
      let accepted: Awaited<ReturnType<typeof index>> | undefined;
      const reads = readLog();
      try {
        await expect
          .poll(
            async () => {
              const current = await reads.read(index());
              const counted =
                current.revision > after &&
                current.changesStatus === "ready" &&
                (!expectedBase || current.baseCommit === expectedBase);
              const matched =
                counted && predicate ? await predicate(current) : undefined;
              reads.record(describeRead(current, matched));
              if (!counted || matched === false) return false;
              accepted = current;
              return true;
            },
            { intervals: [...PUBLICATION_POLL_INTERVALS], timeout: 30_000 },
          )
          .toBe(true);
      } catch (cause) {
        const wanted = [
          `a revision above ${after} with changesStatus ready`,
          ...(expectedBase ? [`baseCommit ${expectedBase}`] : []),
          ...(predicate ? ["the caller's predicate"] : []),
        ].join(", ");
        throw new Error(
          `Serve comparison did not become ready. Wanted ${wanted}.\n${reads.report()}\nServe output:\n${host?.diagnostics?.()}`,
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
      paths: { ...comparisonPaths, ...branchPointPaths, ...movedFixturePaths },
      /** One watched source write, followed by its accepted Changes publication. */
      async edit(name: string, contents: string, predicate?: ReadyPredicate) {
        const previous = await index();
        await replaceSource(root, name, contents);
        return ready(previous.revision, undefined, predicate);
      },
      /** Create a base commit without changing HEAD, the index, or watched files. */
      async commitBase(files: Record<string, string | null>, parent = "base") {
        const selected =
          parent === "base"
            ? baseCommit
            : parent === "head"
              ? headCommit
              : parent;
        return commitBaseSources(root, files, selected);
      },
      /** Move only the private base ref; the working catalogue and HEAD stay fixed. */
      async moveBase(reference: string) {
        const previous = await index();
        const selected =
          reference === "base"
            ? baseCommit
            : reference === "head"
              ? headCommit
              : reference;
        const commit = await git(
          root,
          "rev-parse",
          "--verify",
          "--end-of-options",
          `${selected}^{commit}`,
        );
        const expectedBase = await git(root, "merge-base", commit, "HEAD");
        const previousBase = await git(
          root,
          "merge-base",
          "fixture-base",
          "HEAD",
        );
        if ((await git(root, "rev-parse", "fixture-base")) === commit)
          return ready(0, expectedBase);
        await git(root, "update-ref", "refs/heads/fixture-base", commit);
        return ready(
          previousBase === expectedBase ? 0 : previous.revision,
          expectedBase,
        );
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
