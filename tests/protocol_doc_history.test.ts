import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const milestoneReference = /\bmilestones?\s+\d/giu;

test("protocol documents contain no plan milestone history", async () => {
  await assertProtocolDocHistory(repositoryRoot);
});

test("protocol history scan reports deliberately bad input by file and line", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-doc-history-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  await Promise.all([
    write(
      root,
      "docs/protocol/nested/bad.md",
      "# Contract\nMilestone 22 did it.\nAnother Milestone\n23 did it.\n",
    ),
    write(
      root,
      "docs/protocol/fixtures/ignored.md",
      "Milestone 4 fixture history.\n",
    ),
  ]);

  await assert.rejects(
    assertProtocolDocHistory(root),
    /docs\/protocol\/nested\/bad\.md:2[\s\S]*docs\/protocol\/nested\/bad\.md:3/u,
  );
});

async function assertProtocolDocHistory(root: string): Promise<void> {
  const findings = await protocolDocHistoryFindings(root);
  assert.equal(
    findings.length,
    0,
    `protocol documents must not record plan milestone history:\n${findings.join("\n")}`,
  );
}

async function protocolDocHistoryFindings(root: string): Promise<string[]> {
  const protocolRoot = path.join(root, "docs/protocol");
  const files = await markdownFiles(protocolRoot);
  const findings: string[] = [];
  for (const file of files) {
    const source = await fs.readFile(path.join(protocolRoot, file), "utf8");
    for (const match of source.matchAll(milestoneReference))
      findings.push(
        `docs/protocol/${file}:${lineNumberAt(source, match.index ?? 0)}`,
      );
  }
  return findings;
}

function lineNumberAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

async function markdownFiles(root: string, relative = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, relative), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (child !== "fixtures")
        files.push(...(await markdownFiles(root, child)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(child);
    }
  }
  return files.sort();
}

async function write(
  root: string,
  file: string,
  source: string,
): Promise<void> {
  const absolute = path.join(root, file);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, source);
}
