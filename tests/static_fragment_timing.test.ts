import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { write } from "./helpers/static_changes.js";
import { command, publicationFixture } from "./helpers/static_publication.js";
import { timings } from "./helpers/static_timings.js";

test(
  "JavaScript fragment spans include success and failure without source data",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture(true);
    try {
      for (const status of ["ok", "error"] as const) {
        await write(
          root,
          "specs/home.mockup.ts",
          `
        import { definePage } from '@mokly/mokly';
        export default definePage({ title: 'Home', description: '', relatedDocs: [],
          render() { ${
            status === "ok"
              ? "return '<!doctype html><html><head></head><body><h1>private fragment output</h1></body></html>'"
              : "throw new Error('private fragment failure')"
          }; }
        });
      `,
        );
        const result = await command(
          root,
          "build",
          ["--no-changes", "--debug-timings", "--out=.context/site"],
          "rich",
          {},
          context.signal,
        ).result;
        if (status === "ok") {
          assert.equal(result.code, 0, result.stderr);
          assert.match(
            await fs.readFile(
              path.join(
                root,
                ".context/site/static/mokly-generated/home/index.html",
              ),
              "utf8",
            ),
            /private fragment output/,
          );
        } else {
          assert.notEqual(result.code, 0);
          assert.match(result.stderr, /private fragment failure/);
        }
        const records = timings(result.stderr);
        const fragments = records.filter(
          (record) =>
            record.role === "core" && record.stage === "render.fragment",
        );
        assert.deepEqual(
          fragments.map((record) => record.event),
          ["start", "end"],
        );
        assert.equal(fragments[1]!.status, status);
        const parent = records.find(
          (record) =>
            record.role === "core" && record.id === fragments[0]!.parentId,
        );
        assert.equal(parent!.stage, "render.document");
        assert.equal(parent!.session, fragments[0]!.session);
        assert.ok(
          records.some(
            (record) =>
              record.role === "sidecar" &&
              record.stage === "sidecar.render" &&
              record.event === "end" &&
              record.status === status,
          ),
        );
        assert.doesNotMatch(
          JSON.stringify(fragments),
          /private fragment|home.mockup|handle|props/,
        );
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
