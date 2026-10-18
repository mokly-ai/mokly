import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { git, write } from "./helpers/static_changes.js";
import { cleanupAll } from "./helpers/static_cleanup.js";
import {
  command,
  publicationFixture,
  workspace,
} from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test(
  "base dependency timings report working fallback and failure without paths",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const cache = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-timing-cache-"),
    );
    try {
      await fs.symlink(
        path.join(workspace, "node_modules"),
        path.join(root, "node_modules"),
        "junction",
      );
      await write(
        root,
        "specs/page.mockup.ts",
        "import {definePage} from '@mokly/mokly'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head></head><body>Page</body></html>'});",
      );
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "dependency timing base");
      await git(root, "branch", "timing-base");
      for (const tier of [1, 3, undefined]) {
        if (tier === 3)
          await write(root, "package.json", '{"name":"changed-input"}');
        const location =
          tier === undefined ? path.join(root, ".context/cache") : cache;
        const result = await command(
          root,
          "build",
          ["--out=.context/site", "--base=timing-base", "--debug-timings"],
          "plain",
          {
            XDG_CACHE_HOME: location,
            LOCALAPPDATA: location,
            HOME: location,
          },
          context.signal,
        ).result;
        assert.equal(result.code, tier === undefined ? 1 : 0, result.stderr);
        const all = timings(result.stderr).filter(
          (record) => record.role === "core",
        );
        const records = all.filter(
          (record) => record.stage === "review.base-dependencies",
        );
        if (tier === undefined) {
          assert.deepEqual(records, []);
          assert.equal(
            all.find(
              (record) =>
                record.stage === "review.base-tree" && record.event === "end",
            )!.status,
            "error",
          );
          continue;
        }
        assert.deepEqual(
          records.map((record) => record.event),
          ["start", "end"],
        );
        assert.equal(records[1]!.tier, tier);
        assert.equal(records[1]!.status, "ok");
        const starts = new Map(
          all
            .filter((record) => record.event === "start")
            .map((record) => [record.id, record]),
        );
        const ancestors: string[] = [];
        let parent = records[0]!.parentId;
        while (parent !== undefined) {
          const record = starts.get(parent)!;
          ancestors.push(record.stage);
          parent = record.parentId;
        }
        assert.ok(ancestors.includes("review.base-tree"));
        assert.ok(ancestors.includes("output.write"));
        for (const record of records)
          assert.deepEqual(
            Object.keys(record).filter(
              (key) =>
                ![
                  "schemaVersion",
                  "session",
                  "pid",
                  "role",
                  "stage",
                  "event",
                  "id",
                  "parentId",
                  "elapsedMs",
                  "durationMs",
                  "status",
                  "tier",
                ].includes(key),
            ),
            [],
          );
      }
    } finally {
      await cleanupAll([
        () => fs.rm(root, { recursive: true, force: true }),
        () => fs.rm(cache, { recursive: true, force: true }),
      ]);
    }
  },
);
