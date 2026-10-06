import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { serveReviewArtifactFile } from "../packages/mokly/dist/server/review_responses.js";

test("snapshot serving permits regular files and rejects linked leaves and ancestors", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-snapshots-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const artifact = path.join(root, "artifact");
  await fs.mkdir(path.join(artifact, "snapshots"), { recursive: true });
  await fs.mkdir(path.join(root, "outside"));
  await fs.writeFile(path.join(root, "outside", "secret.html"), "secret");
  await fs.writeFile(path.join(artifact, "snapshots", "view.html"), "view");
  await fs.symlink(
    path.join(root, "outside", "secret.html"),
    path.join(artifact, "leaf.html"),
  );
  await fs.symlink(
    path.join(root, "outside"),
    path.join(artifact, "linked"),
    "dir",
  );
  const server = http.createServer((request, response) =>
    serveReviewArtifactFile(
      artifact,
      request.url!.slice(1),
      response,
      request.method!,
    ),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const valid = await fetch(`${url}/snapshots/view.html`);
  assert.equal(valid.status, 200);
  assert.equal(await valid.text(), "view");
  const head = await fetch(`${url}/snapshots/view.html`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const relative of [
    "leaf.html",
    "linked/secret.html",
    "snapshots",
    "missing.html",
  ]) {
    const response = await fetch(`${url}/${relative}`);
    assert.equal(response.status, 404, relative);
    assert.equal(await response.text(), "Not found");
  }
});
