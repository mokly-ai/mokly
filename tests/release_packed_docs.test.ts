import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { create } from "tar";

import { inspectPublishedDocs } from "../scripts/release/packed_docs.mjs";

// Packaging checks exact source bytes. It does not assert protocol prose.
test("CLI documentation packing keeps the full guide, protocol, fixture and changelog trees", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-packed-docs-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const packed = path.join(root, "package");
  const contents = {
    "docs/guides/start/install.md": "fixture guide",
    "docs/guides/extra/deep/page.md": "fixture nested guide",
    "docs/protocol/receiver.md": "fixture protocol",
    "docs/protocol/fixtures/receiver.json": '{"fixture":true}',
    "CHANGELOG.md": "fixture retained history",
  };
  for (const [file, bytes] of Object.entries(contents)) {
    await fs.mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await fs.writeFile(path.join(source, file), bytes);
  }
  const archive = path.join(root, "fixture.tgz");
  const pack = () =>
    create({ cwd: root, file: archive, gzip: true }, ["package"]);
  await fs.cp(source, packed, { recursive: true });
  await pack();
  await inspectPublishedDocs(archive, source);
  for (const file of Object.keys(contents)) {
    await fs.rm(path.join(packed, file));
    await pack();
    await assert.rejects(
      inspectPublishedDocs(archive, source),
      /complete source/,
    );
    await fs.copyFile(path.join(source, file), path.join(packed, file));
  }
  await fs.appendFile(path.join(packed, "CHANGELOG.md"), " changed");
  await pack();
  await assert.rejects(
    inspectPublishedDocs(archive, source),
    /differs from source: CHANGELOG/,
  );
  await fs.copyFile(
    path.join(source, "CHANGELOG.md"),
    path.join(packed, "CHANGELOG.md"),
  );
  await fs.writeFile(
    path.join(packed, "docs/protocol/extra.md"),
    "not in source",
  );
  await pack();
  await assert.rejects(
    inspectPublishedDocs(archive, source),
    /complete source/,
  );
});
