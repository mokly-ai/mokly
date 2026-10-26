import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { extract } from "tar";

import { ownership } from "./helpers/receiver/ownership.js";
import { complete, plan } from "./helpers/receiver/upload.js";

const exec = promisify(execFile);
interface Case {
  name: string;
  valid: boolean;
  document?: unknown;
  body?: string;
  rejection?: string;
  step?: string;
  status?: number;
  contentType?: string | null;
  outcome?: string;
  viewerUrl?: string | null;
}
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
test(
  "independent reader validates ownership and upload fixtures from the packed package",
  { timeout: 120_000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-installed-receiver-"),
    );
    try {
      const packed = await exec("npm", [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        root,
        "./packages/mokly",
      ]);
      const archive = path.join(
        root,
        (JSON.parse(packed.stdout) as Array<{ filename: string }>)[0]!.filename,
      );
      const installed = path.join(root, "node_modules/@mokly/mokly");
      await fs.mkdir(installed, { recursive: true });
      await extract({ file: archive, cwd: installed, strip: 1 });
      const fixtures = path.join(installed, "docs/protocol/fixtures");
      const markers = JSON.parse(
        await fs.readFile(
          path.join(fixtures, "export-ownership-v3.json"),
          "utf8",
        ),
      ) as { cases: Case[] };
      assert.equal(markers.cases.length, 57);
      for (const entry of markers.cases) {
        if (entry.valid)
          assert.doesNotThrow(
            () => ownership(bytes(entry.document)),
            entry.name,
          );
        else
          assert.throws(
            () => ownership(bytes(entry.document)),
            (error: unknown) =>
              error instanceof Error && error.message === entry.rejection,
            entry.name,
          );
      }
      const uploads = JSON.parse(
        await fs.readFile(path.join(fixtures, "upload-plan-v1.json"), "utf8"),
      ) as { endpoint: string; marker: string[]; cases: Case[] };
      assert.equal(uploads.cases.length, 67);
      for (const entry of uploads.cases) {
        const body =
          entry.body === undefined
            ? bytes(entry.document)
            : Buffer.from(entry.body);
        const status = entry.status ?? 200;
        const contentType =
          entry.contentType === undefined
            ? "application/json"
            : entry.contentType;
        if (entry.step === "complete")
          assert.deepEqual(
            complete(body, status, contentType),
            { outcome: entry.outcome, viewerUrl: entry.viewerUrl ?? null },
            entry.name,
          );
        else if (entry.valid)
          assert.doesNotThrow(
            () =>
              plan(body, uploads.endpoint, uploads.marker, status, contentType),
            entry.name,
          );
        else
          assert.throws(
            () =>
              plan(body, uploads.endpoint, uploads.marker, status, contentType),
            entry.name,
          );
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
