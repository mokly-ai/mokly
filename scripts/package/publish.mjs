import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { inspectPublicCatalogue } from "./catalogue.mjs";
import { runCommand } from "./command.mjs";
import {
  assertCompleteInventory,
  checkOwnershipFixtures,
} from "./ownership.mjs";

/** Exercise only the packed public CLI and documented files against a receiver. */
export async function smokeConsumerPublish(context, root) {
  await checkOwnershipFixtures(path.join(root, "node_modules/@mokly/mokly"));
  const uploads = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    uploads.push({ headers: request.headers, body: Buffer.concat(chunks) });
    response.writeHead(204).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const env = {
      MOKLY_ENDPOINT: `http://127.0.0.1:${port}/upload`,
      MOKLY_TOKEN: "package-smoke-token",
    };
    const bin = path.join(root, "node_modules/.bin/mokly");
    for (const noChanges of [false, true]) {
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
      assert.match(stdout, /Published Mokly catalogue/);
      assert.doesNotMatch(stdout + stderr, /package-smoke-token/);
      const upload = uploads.at(-1);
      assert.equal(
        upload.headers.authorization,
        "Bearer -package-smoke-token==",
      );
      assert.equal(upload.headers["content-type"], "application/gzip");
      const archive = path.join(
        context.workingRoot,
        `upload-${noChanges}.tar.gz`,
      );
      const unpacked = path.join(context.workingRoot, `unpacked-${noChanges}`);
      await fs.promises.writeFile(archive, upload.body);
      await fs.promises.mkdir(unpacked);
      const { stdout: listing } = await runCommand("tar", ["-tzf", archive]);
      await runCommand("tar", ["-xzf", archive, "-C", unpacked]);
      const manifest = JSON.parse(
        await fs.promises.readFile(
          path.join(unpacked, "mokly-upload.json"),
          "utf8",
        ),
      );
      assert.equal(manifest.moklyVersion, context.packageVersion);
      assert.equal(manifest.schemaVersion, 1);
      assert.equal(manifest.configPath, "mokly.config.ts");
      const marker = JSON.parse(
        await fs.promises.readFile(
          path.join(unpacked, ".mokly-export-artifact"),
          "utf8",
        ),
      );
      assertCompleteInventory(marker, listing.trimEnd().split("\n"));
      for (const file of [...marker.files, ".mokly-export-artifact"]) {
        assert.deepEqual(
          await fs.promises.readFile(path.join(unpacked, file)),
          await fs.promises.readFile(path.join(root, "uploaded", file)),
          file,
        );
      }
      for (const file of [
        "index.html",
        "404.html",
        "mokly-upload.json",
        "__mokly/catalogue.json",
        "__mokly/client/inspector.js",
      ])
        assert.ok(
          marker.files.includes(file),
          `missing protocol artifact ${file}`,
        );
      assert.equal(marker.files.includes("static/mokly-manifest.json"), false);
      await inspectPublicCatalogue(unpacked, manifest.comparisonPath);
      if (noChanges) {
        assert.equal(manifest.comparisonPath, null);
        assert.equal(manifest.baseSha, null);
        assert.equal(
          marker.files.some((file) => file.startsWith("__mokly/diffs/")),
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
    assert.equal(uploads.length, 2);
    assert.ok(
      fs.existsSync(
        path.join(
          root,
          "node_modules/@mokly/mokly/docs/protocol/mokly-upload.md",
        ),
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
