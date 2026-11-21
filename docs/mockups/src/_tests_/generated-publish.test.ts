import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { treeStamp } from "../../../../apps/mockups/src/_tests_/served-files";

import { indexPath, screenView } from "./catalogue-paths";
import {
  outputDirectory,
  outputFixture,
  sha256,
} from "./generated-output-fixture";
import { assertNoTrackedGeneratedOutput } from "./generated-output-policy";

/** The ownership marker and the files that a Plan archive carries itself. */
const marker = ".mokly-export-artifact";
const planned = ["mokly-upload.json", indexPath];

/** One upload that the receiver accepted: its Plan archive and its Blobs. */
interface Upload {
  archive: Buffer;
  blobs: Map<string, Buffer>;
}

/** One member of a gzip tar archive, read with the system `tar`. */
function member(archive: Buffer, name: string): Buffer {
  return execFileSync("tar", ["-xzOf", "-", name], { input: archive });
}

/** The path and digest of each file that the archive's marker lists. */
function markerFiles(archive: Buffer): { path: string; sha256: string }[] {
  const value: unknown = JSON.parse(member(archive, marker).toString("utf8"));
  assert.ok(
    typeof value === "object" &&
      value !== null &&
      "files" in value &&
      Array.isArray(value.files),
  );
  return value.files.map((file: unknown) => {
    assert.ok(
      typeof file === "object" &&
        file !== null &&
        "path" in file &&
        typeof file.path === "string" &&
        "sha256" in file &&
        typeof file.sha256 === "string",
    );
    return { path: file.path, sha256: file.sha256 };
  });
}

/** The marker's files, each with the exact bytes that the upload carried. */
function publishedFiles(upload: Upload): Map<string, Buffer> {
  return new Map(
    markerFiles(upload.archive).map((file) => {
      const bytes = planned.includes(file.path)
        ? member(upload.archive, file.path)
        : upload.blobs.get(file.sha256);
      assert.ok(bytes, file.path);
      assert.equal(sha256(bytes), file.sha256, file.path);
      return [file.path, bytes];
    }),
  );
}

function reply(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

/** A receiver that asks for every file outside the Plan archive. */
async function receiver(t: TestContext) {
  const requests: string[] = [];
  const uploads: Upload[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const url = request.url ?? "";
      const body = Buffer.concat(chunks);
      requests.push(url);
      if (url === "/plan") {
        uploads.push({ archive: body, blobs: new Map() });
        const files = markerFiles(body);
        const stored = files
          .filter((file) => planned.includes(file.path))
          .map((file) => file.sha256);
        const missing = [...new Set(files.map((file) => file.sha256))]
          .filter((digest) => !stored.includes(digest))
          .sort();
        reply(response, 200, {
          schemaVersion: 1,
          upload: { id: "fixture", expiresAt: "2099-01-01T00:00:00.000Z" },
          missing,
          blobUrl: origin + "/blobs/{sha256}",
          completeUrl: origin + "/complete",
        });
      } else if (url.startsWith("/blobs/")) {
        uploads.at(-1)?.blobs.set(url.slice("/blobs/".length), body);
        response.statusCode = 204;
        response.end();
      } else reply(response, 201, { viewerUrl: origin + "/catalogue" });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = "http://127.0.0.1:" + address.port;
  return { origin, requests, uploads };
}

test("Publish uploads the bundled CSS and font of its own build and writes nothing into the checkout", async (t) => {
  const fixture = await outputFixture();
  t.after(fixture.cleanup);
  await fixture.git("add", "-A");
  await fixture.git("commit", "-m", "test: derived source");
  const { origin, requests, uploads } = await receiver(t);
  const args = [
    "--strict",
    "--no-changes",
    "--endpoint",
    origin + "/plan",
    "--token",
    "fixture-token",
  ];
  await fixture.write("uncommitted.txt", "Dirty source\n");
  await assert.rejects(
    fixture.cli("publish", ...args),
    (error: Error & { stderr?: string }) => {
      assert.match(error.stderr ?? "", /git-uncommitted/);
      return true;
    },
  );
  assert.equal(requests.length, 0);
  await rm(path.join(fixture.root, "uncommitted.txt"));
  for (const state of ["absent", "corrupt"] as const) {
    if (state === "corrupt") {
      await fixture.cli("build", "--strict", "--no-changes");
      assert.equal(
        sha256(
          await readFile(path.join(fixture.output, fixture.generatedFont)),
        ),
        sha256(await readFile(fixture.sourceFont)),
      );
      await fixture.write(
        outputDirectory + "/" + fixture.generatedFont,
        "Corrupt local font\n",
      );
    }
    const checkout = treeStamp(fixture.root, [".git"]);
    await fixture.cli("publish", ...args);
    assert.deepEqual(treeStamp(fixture.root, [".git"]), checkout, state);
    const upload = uploads.at(-1);
    assert.ok(upload);
    const files = publishedFiles(upload);
    const document = screenView("screen", "mobile");
    const html = files.get(document)?.toString("utf8") ?? "";
    const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)];
    assert.ok(styles.length > 0, "the published document links styles");
    let fontFound = false;
    for (const style of styles) {
      const cssPath = path.posix.join(path.posix.dirname(document), style[1]);
      const css = files.get(cssPath)?.toString("utf8") ?? "";
      if (!css.includes("Geist-Variable.woff2")) continue;
      assert.match(
        css,
        /font-family:\s*Fixture/,
        "the imported CSS is bundled",
      );
      const fonts = [
        ...css.matchAll(/url\(["']?([^\s)"']*Geist-Variable\.woff2)["']?\)/g),
      ];
      assert.ok(fonts.length > 0);
      for (const font of fonts)
        assert.equal(
          sha256(
            files.get(path.posix.join(path.posix.dirname(cssPath), font[1])),
          ),
          sha256(await readFile(fixture.sourceFont)),
        );
      fontFound = true;
    }
    assert.ok(fontFound, "the bundled CSS loads the byte-preserved font");
    await fixture.git("add", "-A");
    assertNoTrackedGeneratedOutput(fixture.root);
  }
  assert.deepEqual(
    requests.filter((url) => !url.startsWith("/blobs/")),
    ["/plan", "/complete", "/plan", "/complete"],
  );
});
