import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  build,
  fixture,
  git,
  screen,
  write,
} from "./helpers/static_changes.js";
import { command, publicationFixture } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test(
  "a failed base preparation ends its timing span with error while unavailable Changes settles",
  { timeout: 120_000 },
  async (context) => {
    const { root } = await fixture();
    try {
      await write(root, "broken.config.json", "{invalid");
      await git(root, "add", "broken.config.json");
      await git(root, "commit", "-qm", "broken historical config");
      await git(root, "branch", "broken-base");
      await write(root, "broken.config.json", "{}");
      const result = await command(
        root,
        "build",
        [
          "--out=.context/site",
          "--config=broken.config.json",
          "--base=broken-base",
          "--debug-timings",
        ],
        "plain",
        {},
        context.signal,
      ).result;
      assert.equal(result.code, 0, result.stderr);
      const ends = timings(result.stderr).filter(
        (record) => record.event === "end",
      );
      assert.equal(
        ends.find((record) => record.stage === "review.base-tree")!.status,
        "error",
      );
      assert.equal(
        ends.find((record) => record.stage === "changes.classify")!.status,
        "ok",
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "Changes timings count final view states and measure sorted changed paths without source data",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"timing-base"}}',
      );
      await write(root, "specs/kept.screen.html", screen("<p>Kept</p>"));
      await write(root, "specs/retired.screen.html", screen("<p>Retired</p>"));
      await write(
        root,
        "specs/ignored.screen.html",
        screen('<mokly-ignore id="clock">Before</mokly-ignore>'),
      );
      await write(
        root,
        "specs/page.page.html",
        "---\ntitle: Page\n---\n<!doctype html><html><head></head><body>Page</body></html>",
      );
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "timing base");
      await git(root, "branch", "timing-base");
      for (const change of [false, true]) {
        if (change) {
          await write(
            root,
            "specs/home.screen.html",
            screen("<h1>Changed</h1>"),
          );
          await write(root, "specs/added.screen.html", screen("<p>Added</p>"));
          await write(
            root,
            "specs/ignored.screen.html",
            screen('<mokly-ignore id="clock">After</mokly-ignore>'),
          );
          await fs.rm(path.join(root, "specs/retired.screen.html"));
        }
        const result = await build(
          root,
          ["--debug-timings"],
          "rich",
          context.signal,
        );
        const records = timings(result.stderr);
        const compared = records.filter(
          (record) => record.stage === "review.compare-views",
        );
        assert.deepEqual(
          compared.map((record) => record.event),
          ["start", "counts", "end"],
        );
        const count = compared[1]!;
        assert.deepEqual(
          [count.views, count.unchanged, count.changed, count.ignoredOnly],
          change ? [11, 3, 6, 2] : [9, 9, 0, 0],
        );
        assert.equal(compared[2]!.status, "ok");
        for (const record of [compared[0]!, compared[2]!])
          for (const field of ["views", "unchanged", "changed", "ignoredOnly"])
            assert.equal(Object.hasOwn(record, field), false);
        assert.equal(count.id, compared[0]!.id);
        const paths = records.filter(
          (record) => record.stage === "review.changed-paths",
        );
        assert.deepEqual(
          paths.map((record) => record.event),
          ["start", "end"],
        );
        assert.equal(paths[1]!.status, "ok");
        assert.equal(paths[0]!.parentId, count.id);
        for (const record of [...compared, ...paths]) {
          assert.ok(!JSON.stringify(record).includes(root));
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
                  "views",
                  "unchanged",
                  "changed",
                  "ignoredOnly",
                ].includes(key),
            ),
            [],
          );
        }
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
