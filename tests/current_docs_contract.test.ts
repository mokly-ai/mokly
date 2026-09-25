import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";

const OLD_FORMAT = [
  /\bmanifest\s*(?:schema\s*)?v5\b/i,
  /\bversion\s+5\s+manifest\b/i,
  /\b(?:public\s+)?catalogue\s+(?:read\s+model\s+)?v1\b/i,
  /\bread\s+model\s+v1\b/i,
  /\bpublic\s+inventory\s+v1\b/i,
  /\b(?:comparison|review\s+result)\s+v[23]\b/i,
  /\bv[23]\s+(?:(?:screen|component)\s+)?(?:comparison|result|artifacts?)\b/i,
  /\bv5\s+pages\b/i,
];
const REMOVED_FIELD =
  /\b(?:ownedDependencies|declaredDependencies|sharedImpact|review\.sharedImpact|shared[ -]impact\s+(?:paths?|patterns?|globs?)|(?:entry\s+)?dependencies\s*:\s*(?:\[|\{|undefined|null)|entry\s+dependencies)/i;
const OLD_BEHAVIOR =
  /\b(?:current\s+(?:code|packages)\s+still\s+emit\s+(?:v5|older)|non-CSS\s+rendered\s+resources\s+retain\s+(?:the\s+)?(?:existing\s+)?file-level\s+policy|target\s+guidance\s+below\s+does\s+not\s+yet)\b/i;
const CURRENT_OLD_FORMAT =
  /\bcurrent\s+(?:manifest\s+v5|(?:public\s+)?catalogue(?:\s+read\s+model)?\s+v1|read\s+model\s+v1|(?:comparison|review\s+result)\s+v[23])\b/i;
const CURRENT_CLAIM =
  /\b(?:current|now|still|emit|write|produce|project|read|require|support|include|retain|remain|use|gain|accept|select|describe|as\s+current)\b/i;
const HISTORICAL_OR_REMOVAL =
  /\b(?:historical|legacy|former|then-current|earlier|prior|older|old\s+format|reject|unsupported|removed|removal|obsolete|never|omitted|omit|strip|dropp?ed|migrat|no\s+version\s+includes|does\s+not\s+carry|do\s+not\s+contain|has\s+no)\b/i;

function staleLine(line: string): boolean {
  const version = OLD_FORMAT.some((pattern) => pattern.test(line));
  const field = REMOVED_FIELD.test(line) && !/\?:\s*never\b/.test(line);
  if (OLD_BEHAVIOR.test(line)) return true;
  if (!version && !field) return false;
  if (
    HISTORICAL_OR_REMOVAL.test(line) &&
    (!CURRENT_OLD_FORMAT.test(line) ||
      /\b(?:reject|unsupported|then-current)\b/i.test(line))
  )
    return false;
  if (
    version &&
    /\b(?:public inventory v1|v5 pages|version 5 manifest)\b/i.test(line)
  )
    return true;
  return field || CURRENT_CLAIM.test(line);
}

async function markdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...(await markdownFiles(candidate)));
    else if (item.name.endsWith(".md")) files.push(candidate);
  }
  return files;
}

test("current docs reject superseded formats and removed source-path inputs", async () => {
  const files = [
    path.join(repositoryRoot, "README.md"),
    ...(
      await Promise.all(
        ["docs/protocol", "docs/architecture", "docs/guides"].map((directory) =>
          markdownFiles(path.join(repositoryRoot, directory)),
        ),
      )
    ).flat(),
    ...(
      await Promise.all(
        ["src", "packages", "examples"].map((directory) =>
          markdownFiles(path.join(repositoryRoot, directory)),
        ),
      )
    )
      .flat()
      .filter((file) => path.basename(file) === "README.md"),
  ];
  const findings: string[] = [];
  for (const file of files) {
    const relative = path.relative(repositoryRoot, file);
    for (const [index, line] of (await fs.readFile(file, "utf8"))
      .split("\n")
      .entries())
      if (staleLine(line))
        findings.push(`${relative}:${index + 1}: ${line.trim()}`);
  }
  assert.deepEqual(findings, []);
});

test("the stale Milestone 9 claims are regression cases while history remains allowed", () => {
  for (const stale of [
    "current code still emits manifest v5 and retains path inputs",
    "public catalogue read model v1 beside the private manifest",
    "For a component-aware catalogue, project the existing v3 result",
    "Screen-only catalogues use the same v2 screen comparison policy",
    "v2 artifacts remain supported without adding component suppression",
    "review configuration selects shared impact patterns",
    'entry dependencies: ["source.ts"]',
    'ownedDependencies: ["action.css"]',
    'sharedImpact: ["shared/**"]',
    "public inventory v1 beside the private manifest",
    "v5 pages, both schemes and viewports",
    "non-CSS rendered resources retain the existing file-level policy",
    "the target guidance below does not yet describe the current example",
    "current manifest v5 has no compatibility fallback",
    "Current catalogue v1 supports legacy pages.",
    "Current comparison v2 keeps legacy evidence.",
  ])
    assert.equal(staleLine(stale), true, stale);
  for (const history of [
    "Historical manifest v5 baselines normalize removed fields.",
    "Catalogue v1 readers reject the old version.",
    "Comparison v2 and v3 are unsupported historical results.",
    "ownedDependencies has been removed; delete this field.",
    "dependencies?: never;",
  ])
    assert.equal(staleLine(history), false, history);
});
