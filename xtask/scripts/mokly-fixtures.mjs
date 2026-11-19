// Regenerate every golden byte from frozen sources and the built workspace CLI.
import assert from "node:assert/strict";
import {
  access,
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const check = process.argv.slice(2).includes("--check");
try {
  await access(join(root, "node_modules"));
} catch {
  console.error("Mokly fixture dependencies are missing. Run npm ci first.");
  process.exit(1);
}
const { fixtureRuntime, checkoutSources, commit, encode, json } =
  await import("./mokly-fixture-runtime.mjs");
const { captureArtifacts } = await import("./mokly-fixture-artifacts.mjs");
const { FIXTURE_VERSION, sha256 } =
  await import("./mokly-fixture-normalize.mjs");
const { captureCliErrors } = await import("./mokly-cli-errors.mjs");
const require = createRequire(join(root, "package.json"));
const tar = require("tar");
const destination = join(root, "crates/mkc-mokly-contract/fixtures");
const packageRoot = join(root, "packages/mokly");
const workspacePackage = await json(join(packageRoot, "package.json"));
const temporary = await mkdtemp(join(tmpdir(), "mkc-mokly-fixtures-"));

async function generate(moves, runtime) {
  const checkout = join(temporary, moves ? "moves" : "original");
  const source = join(destination, moves ? "moves/src" : "src");
  await checkoutSources(checkout, source, runtime, moves);
  if (moves) {
    await rm(join(checkout, "catalogue/src"), { recursive: true });
    await cp(
      join(source, "current/catalogue/src"),
      join(checkout, "catalogue/src"),
      { recursive: true },
    );
  } else {
    for (const [path, before, after] of [
      [
        "catalogue/src/entries/notice.component.html",
        "Ready to review",
        "Ready to publish",
      ],
      [
        "catalogue/src/entries/start.screen.html",
        "Review the draft</h1>",
        "Publish the draft</h1>",
      ],
      [
        "catalogue/src/entries/publish.use-case.yaml",
        "title: Review the draft",
        "title: Publish the draft",
      ],
      [
        "catalogue/src/entries/page.page.html",
        "Draft publication</h1>",
        "Ready publication</h1>",
      ],
      [
        "catalogue/src/entries/guide.md",
        "Review the draft before publication.",
        "Publish the reviewed draft.",
      ],
      ["catalogue/styles.css", "#334155", "#0f766e"],
    ]) {
      const original = await readFile(join(checkout, path), "utf8");
      assert.equal(
        original.split(before).length,
        2,
        `Missing or repeated fixture edit: ${path}`,
      );
      await writeFile(join(checkout, path), original.replace(before, after));
    }
  }
  commit(checkout, runtime, "comparison");
  const generated = await captureArtifacts(
    tar,
    runtime,
    checkout,
    workspacePackage.version,
  );
  const files = moves
    ? new Map(
        [...generated].map(([name, bytes]) => [
          name === "dogfood.tar.gz" ? "moves-export.tar.gz" : `moves-${name}`,
          bytes,
        ]),
      )
    : generated;
  if (!moves) {
    for (const name of [
      "export-ownership-v3.json",
      "upload-plan-v1.json",
      "catalogue-v9.json",
    ]) {
      files.set(
        name,
        await readFile(join(root, "docs/protocol/fixtures", name)),
      );
    }
    files.set(
      "cli-errors.json",
      await captureCliErrors(root, temporary, runtime, FIXTURE_VERSION),
    );
  }
  const metadata = { moklyVersion: FIXTURE_VERSION };
  if (moves)
    Object.assign(metadata, {
      viewerVersion: FIXTURE_VERSION,
      corpusSha256: sha256(
        await readFile(join(destination, "index-v9-cases.json")),
      ),
    });
  files.set(
    moves ? "moves-checksums.json" : "checksums.json",
    Buffer.from(
      encode({
        ...metadata,
        files: Object.fromEntries(
          [...files]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([name, bytes]) => [name, sha256(bytes)]),
        ),
      }),
    ),
  );
  return files;
}

const authored = new Set([
  "src",
  "moves",
  "README.md",
  "index-v9-cases.json",
  "index-corpus.mjs",
  "check-index-corpus.mjs",
]);

try {
  const runtime = await fixtureRuntime(root, temporary);
  assert.equal(
    runtime.run(runtime.cli, ["--version"], root),
    workspacePackage.version,
    "Built Mokly version differs from the workspace",
  );
  const files = new Map([
    ...(await generate(false, runtime)),
    ...(await generate(true, runtime)),
  ]);
  assert.deepEqual(
    await readdir(join(destination, "moves")),
    ["src"],
    "Unexpected moves source entry",
  );
  const names = await readdir(destination);
  const extra = names.filter((name) => !authored.has(name) && !files.has(name));
  if (check) {
    const drift = [...extra];
    for (const [name, bytes] of files) {
      const previous = names.includes(name)
        ? await readFile(join(destination, name))
        : null;
      if (!previous?.equals(bytes)) drift.push(name);
    }
    assert.equal(
      drift.length,
      0,
      `Mokly fixture drift: ${drift.sort().join(", ")}. Run cargo xtask mokly-fixtures and review the changes.`,
    );
    console.log(`Mokly fixtures match (${files.size} files).`);
    console.log(
      runtime.run(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          await readFile(join(destination, "check-index-corpus.mjs"), "utf8"),
          join(destination, "index-v9-cases.json"),
          ...["index-v9.json", "moves-index-v9.json", "catalogue-v9.json"].map(
            (name) => join(destination, name),
          ),
        ],
        root,
      ),
    );
    console.log("Public viewer index conformance passed.");
  } else {
    assert.equal(
      extra.length,
      0,
      `Unexpected fixtures: ${extra.join(", ")}; remove them deliberately before regeneration.`,
    );
    for (const [name, bytes] of files)
      await writeFile(join(destination, name), bytes);
    console.log(`Regenerated Mokly fixtures (${files.size} files).`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
