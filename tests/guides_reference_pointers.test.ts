import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import { codeCell, GUIDES, tableRows } from "./helpers/guides.js";

const HISTORICAL = /^(?:plans|docs\/reviews)\//u;
const POINTERS = [
  ["README.md", "./docs/guides/reference/export-files.md"],
  ["README.md", "./docs/guides/reference/upload-receiver.md"],
  [
    ".github/actions/publish/README.md",
    "../../../docs/guides/reference/upload-receiver.md",
  ],
  ["packages/viewer/README.md", "../../docs/guides/reference/export-files.md"],
  ["src/publish/README.md", "../../docs/guides/reference/upload-receiver.md"],
  ["docs/protocol/mokly-upload.md", "../guides/reference/upload-receiver.md"],
  [
    "docs/protocol/mokly-export-ownership.md",
    "../guides/reference/export-files.md",
  ],
  [
    "docs/protocol/mokly-export-delivery.md",
    "../guides/reference/export-files.md",
  ],
  ["docs/protocol/mokly-navigation.md", "../guides/authoring/links.md"],
  ["docs/protocol/mokly-link-controls.md", "../guides/authoring/links.md"],
  ["docs/protocol/mokly-pages.md", "../guides/authoring/pages.md"],
] as const;
const read = (file: string) =>
  readFileSync(path.join(repositoryRoot, file), "utf8");

function relativeLinks(source: string): string[] {
  return [
    ...source
      .replace(/```[\s\S]*?```/gu, "")
      .replace(/`[^`\n]*`/gu, "")
      .matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu),
  ]
    .map(([, target]) => target ?? "")
    .filter((target) => !/^(?:[a-z][a-z0-9+.-]*:|#|\/)/iu.test(target));
}

test("every relative link in living Markdown resolves to a file", () => {
  const files = execFileSync("git", ["ls-files", "*.md"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => !HISTORICAL.test(file));
  assert.ok(files.length > 50);
  const broken = files.flatMap((file) =>
    relativeLinks(read(file))
      .filter(
        (target) =>
          !existsSync(
            path.resolve(
              repositoryRoot,
              path.dirname(file),
              decodeURI(target.split("#")[0] ?? ""),
            ),
          ),
      )
      .map((target) => `${file} -> ${target}`),
  );
  assert.deepEqual(broken, []);
});

test("docs that integrators start from point at the reference guides", () => {
  for (const [file, target] of POINTERS)
    assert.ok(
      relativeLinks(read(file)).some((link) => link.split("#")[0] === target),
      `${file} must link ${target}`,
    );
  const packaging = read("docs/protocol/mokly-package.md");
  assert.doesNotMatch(packaging, /Reference allowlist|link mapping/iu);
  assert.ok(relativeLinks(packaging).includes("./mokly-guides.md"));
  assert.doesNotMatch(
    read("docs/protocol/mokly-upload.md").replace(/\s+/gu, " "),
    /public contract for hosted and self-hosted receivers/u,
  );
});

test("withdrawn Reference routes redirect to guides that exist", () => {
  const contract = read("docs/protocol/mokly-guides.md");
  const section = /\n### Withdrawn Routes\n([\s\S]*?)(?=\n## |\n### |$)/u.exec(
    contract,
  )?.[1];
  assert.ok(section, "the contract lists withdrawn routes");
  const rows = tableRows(section);
  const routes = new Map(
    rows.map(([from, to]) => [codeCell(from), codeCell(to)] as const),
  );
  assert.deepEqual(
    [...routes.keys()].sort(),
    [
      "export-delivery",
      "export-ownership",
      "link-controls",
      "navigation",
      "pages",
      "upload",
    ].map((slug) => `/docs/reference/${slug}/`),
  );
  const current = new Set(GUIDES.map((guide) => `/docs/${guide.id}/`));
  for (const [from, to] of routes) {
    assert.ok(current.has(to), `${from} redirects to missing ${to}`);
    assert.equal(current.has(from), false, `${from} is reused`);
  }
});
