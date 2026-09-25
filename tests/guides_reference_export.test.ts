import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  EXPORT_MARKER,
  parseExportOwnership,
} from "../dist/export/ownership.js";
import { exportCatalogue } from "../dist/export/run.js";
import { publicationComparisonMetadata } from "../dist/publication/removed_previews.js";
import { UPLOAD_MANIFEST } from "../dist/publish/manifest.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { codeCell, GUIDES, guideSection, tableRows } from "./helpers/guides.js";

const guide =
  GUIDES.find((page) => page.id === "reference/export-files")?.body ?? "";
const flat = (text: string) => text.replace(/\s+/gu, " ");
const read = (file: string) =>
  readFileSync(path.join(repositoryRoot, file), "utf8");

function pattern(documented: string): RegExp {
  const literal = documented
    .split(/<[^>]+>/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join(".+");
  return new RegExp(`^${literal}${documented.endsWith("/") ? ".+" : ""}$`, "u");
}

function codeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/gu)].map(([, value]) => value ?? "");
}

test("the layout table accounts for every file in real exports", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const files = [...(await directoryFiles(fixture.output)).keys()];
  const rows = tableRows(guideSection(guide, "Layout"));
  const documented = rows
    .map(([cell]) => cell ?? "")
    .filter((cell) => cell.startsWith("`"))
    .map((cell) => codeCell(cell));
  assert.ok(rows.some(([cell]) => cell === "Other files under `__mokly/`"));
  assert.ok(documented.includes(EXPORT_MARKER));
  assert.ok(documented.includes(UPLOAD_MANIFEST));
  for (const entry of documented.filter((entry) => entry !== UPLOAD_MANIFEST))
    assert.ok(
      files.some((file) => pattern(entry).test(file)),
      `${entry} is documented but not exported`,
    );
  for (const file of files)
    assert.ok(
      file.startsWith("__mokly/") ||
        documented.some((entry) => pattern(entry).test(file)),
      `${file} is exported but not documented`,
    );
  for (const file of ["__mokly/shell.css", "__mokly/client/", "__mokly/fonts/"])
    assert.ok(
      files.some((name) => name.startsWith(file)),
      file,
    );
  assert.equal(files.includes(UPLOAD_MANIFEST), false);
  assert.equal(files.includes("mokly-manifest.json"), false);
  assert.equal(
    files.filter((file) =>
      /^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/u.test(file),
    ).length,
    1,
  );
  await exportCatalogue(fixture.config, { outDir: "current", noChanges: true });
  const current = [
    ...(await directoryFiles(path.join(fixture.root, "current"))).keys(),
  ];
  assert.equal(
    current.some((file) => file.startsWith("__mokly/diffs/")),
    false,
  );
  assert.match(flat(guide), /published with `--no-changes` has none/u);
});

test("the documented ownership marker rules are the reader's rules", () => {
  const marker = guideSection(guide, "The ownership marker");
  const example = /```json\n([\s\S]*?)```/u.exec(marker)?.[1] ?? "";
  assert.deepEqual(parseExportOwnership(example), JSON.parse(example));
  const parse = (files: unknown[], extra: object = {}) =>
    parseExportOwnership(JSON.stringify({ schemaVersion: 1, files, ...extra }));
  const [first, second, third, fourth] =
    /`([^`]+)` and `([^`]+)` collide, while `([^`]+)` and `([^`]+)` do not/u
      .exec(flat(marker))
      ?.slice(1) ?? [];
  assert.equal(parse([first, second]), undefined);
  assert.deepEqual(parse([third, fourth])?.files, [third, fourth]);
  for (const unsafe of [
    "/index.html",
    "view//home.html",
    "./index.html",
    "view/../index.html",
    "view\\home.html",
    "view:home.html",
    "view/home\0.html",
    EXPORT_MARKER,
  ])
    assert.equal(parse([unsafe]), undefined, JSON.stringify(unsafe));
  assert.deepEqual(parse(["static/café.svg"], { future: ["../x"] }), {
    schemaVersion: 1,
    files: ["static/café.svg"],
  });
  assert.equal(
    parseExportOwnership('{"schemaVersion":2,"files":[]}'),
    undefined,
  );
  const fixture = /`node_modules\/@mokly\/mokly\/([^`]+)`/u.exec(marker)?.[1];
  assert.ok(fixture);
  const packaged = (JSON.parse(read("package.json")) as { files: string[] })
    .files;
  assert.ok(packaged.some((entry) => fixture.startsWith(`${entry}/`)));
  const cases = (
    JSON.parse(read(fixture)) as {
      cases: Array<Record<string, unknown>>;
    }
  ).cases;
  assert.ok(cases.length > 0);
  for (const item of cases)
    assert.deepEqual(Object.keys(item).sort(), ["document", "name", "valid"]);
});

test("serving headers agree with the delivery and preview contracts", () => {
  const caching = tableRows(guideSection(guide, "Caching headers"));
  const comparison = caching.find(
    ([files]) => files === "Under `__mokly/diffs/`",
  );
  const headers = codeSpans(comparison?.[1] ?? "");
  const preview = publicationComparisonMetadata(
    `/__mokly/diffs/__generations/${"e".repeat(64)}/review.json`,
  ).headers;
  assert.deepEqual(headers, [
    "Cache-Control: no-store",
    "X-Content-Type-Options: nosniff",
  ]);
  for (const header of headers) assert.ok(preview.includes(header), header);
  assert.ok(preview.startsWith("/__mokly/diffs/*\n"));
  const embedding = guideSection(guide, "Embedding from another origin");
  const paths = codeSpans(
    (embedding.split("Send these headers")[0] ?? "")
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .join(" "),
  );
  const delivery = flat(read("docs/protocol/mokly-export-delivery.md"));
  const contract = /public fetch paths are (.*?)\. Send/u.exec(delivery)?.[1];
  assert.ok(contract);
  assert.deepEqual(
    paths.sort(),
    codeSpans(contract)
      .map((value) => value.replace(/\*\*$/u, ""))
      .sort(),
  );
  const fence = /```http\n([\s\S]*?)```/u.exec(embedding)?.[1] ?? "";
  const names = fence
    .trim()
    .split("\n")
    .map((line) => line.split(": ")[0]);
  assert.deepEqual(names, [
    "Access-Control-Allow-Origin",
    "X-Content-Type-Options",
  ]);
  assert.ok(fence.includes("X-Content-Type-Options: nosniff"));
  assert.match(
    flat(embedding),
    /add `Vary: Origin` when you choose the allowed origin per request/u,
  );
  for (const header of [
    "Access-Control-Allow-Origin",
    "X-Content-Type-Options: nosniff",
    "Vary: Origin",
  ])
    assert.ok(delivery.includes(header), header);
});
