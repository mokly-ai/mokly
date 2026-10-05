import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

const protocolRoot = path.join(repositoryRoot, "docs/protocol");

function sentences(source: string): Set<string> {
  const body = source.replace(/```[\s\S]*?```/gu, " ").replace(/\s+/gu, " ");
  return new Set(
    body
      .split(/(?<=[.!?])\s+/u)
      .map((sentence) => sentence.trim().toLowerCase())
      .filter((sentence) => sentence.length >= 60),
  );
}

function protocolFindings(pages: ReadonlyMap<string, string>): string[] {
  const names = [...pages.keys()].sort();
  const findings: string[] = [];
  const titles = new Map<string, string>();
  const sentenceSets = new Map<string, Set<string>>();
  for (const [name, source] of pages) {
    if (/mainline/iu.test(name))
      findings.push(`${name}: integration-only filename`);
    const title = /^# (.+)$/mu.exec(source)?.[1]?.trim();
    if (title) {
      if (/mainline/iu.test(title))
        findings.push(`${name}: integration-only title`);
      const earlier = titles.get(title);
      if (earlier)
        findings.push(`duplicate title ${title}: ${earlier}, ${name}`);
      else titles.set(title, name);
    }
    const parent =
      /^Continuation of \[[^\]]+\]\(\.\/([^#)]+\.md)(?:#[^)]+)?\)\./mu.exec(
        source,
      )?.[1];
    if (parent && !pages.get(parent)?.includes(`./${name}`))
      findings.push(`${name}: not linked from ${parent}`);
    if (name === "README.md")
      for (const line of source.split("\n"))
        if (/^\s*- .*mainline/iu.test(line))
          findings.push("README.md: integration-only index entry");
    sentenceSets.set(name, sentences(source));
  }
  for (let index = 0; index < names.length; index += 1) {
    const first = names[index]!;
    const firstSentences = sentenceSets.get(first)!;
    for (const second of names.slice(index + 1)) {
      const shared = [...firstSentences].filter((sentence) =>
        sentenceSets.get(second)!.has(sentence),
      ).length;
      if (shared >= 5)
        findings.push(`${first} and ${second}: ${shared} repeated sentences`);
    }
  }
  return findings;
}

test("protocol continuations, titles and substantive sentences have one owner", async () => {
  const names = (await fs.readdir(protocolRoot))
    .filter((name) => name.endsWith(".md"))
    .sort();
  const pages = new Map(
    await Promise.all(
      names.map(
        async (name) =>
          [
            name,
            await fs.readFile(path.join(protocolRoot, name), "utf8"),
          ] as const,
      ),
    ),
  );
  assert.deepEqual(protocolFindings(pages), []);
});

test("protocol structure guard rejects unlinked pages, duplicate titles and repeated contracts", () => {
  const repeated = Array.from(
    { length: 6 },
    (_, index) =>
      `This is a deliberately substantive contract sentence numbered ${index} that both pages repeat.`,
  ).join("\n");
  const findings = protocolFindings(
    new Map([
      ["parent.md", `# Parent\n${repeated}`],
      [
        "child.md",
        `# Duplicate\nContinuation of [Parent](./parent.md).\n${repeated}`,
      ],
      ["other.md", `# Duplicate\n${repeated}`],
    ]),
  );
  assert.ok(
    findings.some((finding) => finding.includes("not linked from parent.md")),
  );
  assert.ok(
    findings.some((finding) => finding.includes("duplicate title Duplicate")),
  );
  assert.ok(
    findings.some((finding) => /: [5-9] repeated sentences/u.test(finding)),
  );
});
