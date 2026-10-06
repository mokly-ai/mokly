import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { inspectPublicCatalogue } from "./catalogue.mjs";
import { runCommand } from "./command.mjs";
import { commitSmokeEdits } from "./fixture.mjs";
import {
  assertCompleteInventory,
  assertOwnershipMarker,
  checkOwnershipFixtures,
  verifyOwnershipFiles,
} from "./ownership.mjs";
import {
  assertBlob,
  extractArchive,
  requestBytes,
  validBlob,
} from "./publish_exchange.mjs";
import { checkUploadManifestFixtures } from "./upload_manifest.mjs";
import { checkUploadPlanFixtures } from "./upload_plan.mjs";

/** Exercise only the packed public CLI and documented files against a receiver. */
export async function smokeConsumerPublish(context, root) {
  const packageRoot = path.join(root, "node_modules/@mokly/mokly");
  await checkOwnershipFixtures(packageRoot);
  await checkUploadPlanFixtures(packageRoot);
  await checkUploadManifestFixtures(packageRoot);
  const plans = [];
  const blobs = new Map();
  const uploads = new Map();
  const publications = new Map();
  let origin = "";
  const server = http.createServer(async (request, response) => {
    assert.equal(
      request.headers.authorization,
      "Bearer -package-smoke-token==",
    );
    const url = new URL(request.url ?? "/", origin);
    if (request.method === "POST" && url.pathname === "/upload") {
      const body = await requestBytes(request);
      assert.equal(request.headers["content-type"], "application/gzip");
      assert.equal(request.headers.accept, "application/json");
      assert.equal(request.headers["content-length"], String(body.length));
      const files = await extractArchive(body);
      const marker = JSON.parse(
        files.get(".mokly-export-artifact").toString("utf8"),
      );
      const entries = assertOwnershipMarker(marker);
      const manifest = JSON.parse(
        files.get("mokly-upload.json").toString("utf8"),
      );
      assert.deepEqual(
        [...files.keys()],
        [
          "mokly-upload.json",
          ".mokly-export-artifact",
          ...(manifest.comparisonPath ? [manifest.comparisonPath] : []),
        ],
      );
      for (const entry of entries) {
        const archived = files.get(entry.path);
        if (archived) {
          assertBlob(entry, entry.sha256, archived);
          blobs.set(entry.sha256, archived);
        }
      }
      const id = `upload-${plans.length + 1}`;
      const byDigest = new Map(entries.map((entry) => [entry.sha256, entry]));
      const publicationKey = `${manifest.headSha}\0${manifest.configPath}`;
      const existing = manifest.uncommittedChanges
        ? undefined
        : publications.get(publicationKey);
      const missing = existing
        ? []
        : [...byDigest.keys()].filter((digest) => !blobs.has(digest)).sort();
      const plan = {
        body,
        files,
        marker,
        entries,
        missing,
        byDigest,
        manifest,
        publicationKey,
        received: new Map(),
        existing,
      };
      uploads.set(id, plan);
      plans.push(plan);
      response.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          schemaVersion: 1,
          upload: {
            id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
          },
          missing,
          blobUrl: `${origin}/blobs/${id}/{sha256}`,
          completeUrl: `${origin}/complete/${id}`,
        }),
      );
      return;
    }
    const blob = /^\/blobs\/([^/]+)\/([a-f0-9]{64})$/u.exec(url.pathname);
    if (request.method === "PUT" && blob) {
      const [, id, digest] = blob;
      const bytes = await requestBytes(request);
      const upload = uploads.get(id);
      const entry = upload?.byDigest.get(digest);
      if (!entry || !validBlob(entry, digest, bytes)) {
        response.writeHead(400).end();
        return;
      }
      blobs.set(digest, bytes);
      upload.received.set(digest, bytes);
      response.writeHead(204).end();
      return;
    }
    const complete = /^\/complete\/([^/]+)$/u.exec(url.pathname);
    if (request.method === "POST" && complete) {
      const upload = uploads.get(complete[1]);
      if (
        !upload ||
        [...upload.byDigest.keys()].some((digest) => !blobs.has(digest))
      ) {
        response.writeHead(409).end();
        return;
      }
      if (upload.existing) {
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify(upload.existing));
        return;
      }
      const publication = {
        viewerUrl: `${origin}/catalogues/${complete[1]}/view`,
      };
      if (!upload.manifest.uncommittedChanges)
        publications.set(upload.publicationKey, publication);
      response
        .writeHead(201, { "Content-Type": "application/json" })
        .end(JSON.stringify(publication));
      return;
    }
    request.resume();
    response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    origin = `http://127.0.0.1:${port}`;
    const env = {
      MOKLY_ENDPOINT: `${origin}/upload`,
      MOKLY_OUTPUT: "plain",
      MOKLY_TOKEN: "package-smoke-token",
    };
    const bin = path.join(root, "node_modules/.bin/mokly");
    for (const noChanges of [false, true]) {
      blobs.clear();
      publications.clear();
      const dirty = !noChanges;
      if (!dirty) await commitSmokeEdits(root);
      const { stdout, stderr } = await runCommand(
        bin,
        [
          "publish",
          "--token=-package-smoke-token==",
          "--out",
          "uploaded",
          "--repository",
          "github.com/sample/catalogue",
          ...(noChanges ? ["--no-changes"] : ["--base", "HEAD"]),
        ],
        { cwd: root, env },
      );
      const plan = plans.at(-1);
      const sent = new Set(plan.received.keys());
      for (const bytes of plan.files.values())
        sent.add(crypto.createHash("sha256").update(bytes).digest("hex"));
      const uploaded = plan.entries.filter(({ sha256 }) =>
        sent.has(sha256),
      ).length;
      assert.equal(
        stdout,
        `Published Mokly catalogue. ${uploaded} ${uploaded === 1 ? "file" : "files"} uploaded, ${plan.entries.length - uploaded} unchanged.\n` +
          (dirty ? "This publication includes uncommitted changes.\n" : "") +
          `${origin}/catalogues/upload-${plans.length}/view\n`,
      );
      assert.doesNotMatch(stdout + stderr, /package-smoke-token/);
      const manifest = plan.manifest;
      assert.equal(manifest.moklyVersion, context.packageVersion);
      assert.equal(manifest.schemaVersion, 2);
      assert.equal(manifest.uncommittedChanges, dirty);
      assert.equal(manifest.configPath, "mokly.config.ts");
      assert.deepEqual(
        [...plan.files.keys()],
        [
          "mokly-upload.json",
          ".mokly-export-artifact",
          ...(manifest.comparisonPath ? [manifest.comparisonPath] : []),
        ],
      );
      const unpacked = path.join(context.workingRoot, `unpacked-${noChanges}`);
      await fs.promises.mkdir(unpacked);
      assert.deepEqual(
        [...plan.received.keys()].sort(),
        [...plan.missing].sort(),
      );
      for (const entry of plan.entries) {
        const bytes =
          plan.files.get(entry.path) ?? plan.received.get(entry.sha256);
        assert.ok(bytes, entry.path);
        assertBlob(entry, entry.sha256, bytes);
        const target = path.join(unpacked, entry.path);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.writeFile(target, bytes);
        assert.deepEqual(
          bytes,
          await fs.promises.readFile(path.join(root, "uploaded", entry.path)),
          entry.path,
        );
      }
      await fs.promises.writeFile(
        path.join(unpacked, ".mokly-export-artifact"),
        plan.files.get(".mokly-export-artifact"),
      );
      assert.deepEqual(
        plan.files.get(".mokly-export-artifact"),
        await fs.promises.readFile(
          path.join(root, "uploaded/.mokly-export-artifact"),
        ),
      );
      assertCompleteInventory(plan.marker, [
        ...plan.entries.map(({ path: name }) => name),
        ".mokly-export-artifact",
      ]);
      await verifyOwnershipFiles(plan.marker, unpacked);
      const files = plan.entries.map(({ path: name }) => name);
      for (const file of [
        "index.html",
        "404.html",
        "mokly-upload.json",
        "__mokly/catalogue.json",
        "__mokly/client/inspector.js",
        "__mokly/client/react-shell.js",
      ])
        assert.ok(files.includes(file), `missing protocol artifact ${file}`);
      assert.equal(files.includes("static/mokly-manifest.json"), false);
      await inspectPublicCatalogue(unpacked, manifest.comparisonPath);
      if (noChanges) {
        assert.equal(manifest.comparisonPath, null);
        assert.equal(manifest.baseSha, null);
        assert.equal(
          files.some((file) => file.startsWith("__mokly/diffs/")),
          false,
        );
      } else {
        const review = JSON.parse(
          await fs.promises.readFile(
            path.join(unpacked, manifest.comparisonPath),
            "utf8",
          ),
        );
        assert.equal(manifest.baseSha, review.baseCommit);
        assert.equal(manifest.baseRef, review.baseRef);
      }
    }
    assert.equal(plans.length, 2);
    assert.ok(
      fs.existsSync(path.join(packageRoot, "docs/protocol/mokly-upload.md")),
    );
    assert.ok(
      fs.existsSync(
        path.join(packageRoot, "docs/protocol/mokly-upload-exchange.md"),
      ),
    );
    assert.ok(
      fs.existsSync(
        path.join(packageRoot, "docs/protocol/mokly-upload-validation.md"),
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
