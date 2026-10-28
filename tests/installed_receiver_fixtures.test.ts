import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { extract } from "tar";

import {
  ownership,
  verifyInventory,
  digest,
} from "./helpers/receiver/ownership.js";
import { complete, plan, upload } from "./helpers/receiver/upload.js";
import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";
import { observeBuild } from "./helpers/static_received.js";

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
  blobEncoding?: "gzip" | "identity";
}
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
test(
  "independent reader validates ownership and upload fixtures from the packed package",
  { timeout: 120_000 },
  async (context) => {
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
        await context.test(entry.name, () => {
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
        });
      }
      const uploads = JSON.parse(
        await fs.readFile(path.join(fixtures, "upload-plan-v1.json"), "utf8"),
      ) as { endpoint: string; marker: string[]; cases: Case[] };
      assert.equal(uploads.cases.length, 74);
      for (const entry of uploads.cases.filter(
        (entry) => entry.step !== "complete",
      )) {
        await context.test(entry.name, () => {
          const body =
            entry.body === undefined
              ? bytes(entry.document)
              : Buffer.from(entry.body);
          const status = entry.status ?? 200;
          const contentType =
            entry.contentType === undefined
              ? "application/json"
              : entry.contentType;
          if (entry.valid)
            assert.equal(
              plan(body, uploads.endpoint, uploads.marker, status, contentType),
              entry.blobEncoding ?? "identity",
              entry.name,
            );
          else
            assert.throws(
              () =>
                plan(
                  body,
                  uploads.endpoint,
                  uploads.marker,
                  status,
                  contentType,
                ),
              entry.name,
            );
        });
      }
      for (const entry of uploads.cases.filter(
        (entry) => entry.step === "complete",
      )) {
        await context.test(entry.name, () => {
          const body =
            entry.body === undefined
              ? bytes(entry.document)
              : Buffer.from(entry.body);
          const status = entry.status ?? 200;
          const contentType =
            entry.contentType === undefined
              ? "application/json"
              : entry.contentType;
          assert.deepEqual(
            complete(body, status, contentType),
            { outcome: entry.outcome, viewerUrl: entry.viewerUrl ?? null },
            entry.name,
          );
        });
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

test(
  "independent receiver checks a real publication and rejects missing extra duplicate and changed bytes",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const server = await exchange();
    let output: string | undefined;
    try {
      const result = await observeBuild(
        server,
        publish(root, server.endpoint, "plain", {
          signal: context.signal,
        }),
      ).result;
      output = directory(result.stdout);
      assert.equal(result.code, 0, result.stderr);
      const artifact = [...server.completedInventories[0]!];
      assert.ok(verifyInventory(artifact).length > 3);
      const metadata = artifact.find(
        ([name]) => name === "mokly-upload.json",
      )![1];
      upload(metadata);
      for (const altered of [
        artifact.filter(([name]) => name !== ".mokly-export-artifact"),
        artifact.filter(([name]) => name !== "index.html"),
        [...artifact, ["extra", Buffer.from("x")] as [string, Buffer]],
        [...artifact, artifact[0]!],
        artifact.map(
          ([name, data]) =>
            [name, name === "index.html" ? Buffer.from("corrupt") : data] as [
              string,
              Buffer,
            ],
        ),
      ])
        assert.throws(() => verifyInventory(altered), /invalid/u);
      const sameLength = artifact.map(
        ([name, data]) =>
          [
            name,
            name === "index.html" ? Buffer.alloc(data.length, 63) : data,
          ] as [string, Buffer],
      );
      assert.throws(() => verifyInventory(sameLength), /invalid/u);
      const marker = {
        schemaVersion: 3,
        files: [{ path: "x", sha256: digest(Buffer.from("x")), size: 1 }],
      };
      assert.throws(
        () =>
          ownership(
            Buffer.from(
              JSON.stringify(marker).replace(
                '"schemaVersion":3',
                '"schemaVersion":3,"schemaVersion":3',
              ),
            ),
          ),
        /invalid/u,
      );
      const envelope = JSON.parse(metadata.toString()) as Record<
        string,
        unknown
      >;
      for (const schemaVersion of [1, 2, 4, "3"])
        assert.throws(
          () => upload(bytes({ ...envelope, schemaVersion })),
          /unsupported-version/u,
        );
      for (const moklyVersion of [
        "01.2.3",
        "1.2.3-01",
        "1.2.3-a..b",
        "1.2.3+empty..segment",
      ])
        assert.throws(
          () => upload(bytes({ ...envelope, moklyVersion })),
          /invalid/u,
        );
      assert.doesNotThrow(() =>
        upload(
          bytes({
            ...envelope,
            moklyVersion: "999999999999999999999.2.3-alpha.1+build.9",
          }),
        ),
      );
      assert.throws(
        () => upload(bytes({ ...envelope, extra: true })),
        /invalid/u,
      );
    } finally {
      await cleanupAll([
        () => server.close(),
        async () => {
          if (output) await removeOutput(output);
        },
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);
