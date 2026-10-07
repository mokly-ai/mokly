import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export interface DocStatement {
  file: string;
  line: number;
  text: string;
  delivery: boolean;
}

export interface DocException {
  file: string;
  statement: string;
  reason: string;
}

export const normalizeStatement = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

function statementParts(block: string): string[] {
  if (/^\s*(?:`{3}|~{3}|\||#)/.test(block)) return [block];
  const parts: string[] = [];
  let start = 0;
  let code = false;
  for (let index = 0; index < block.length; index += 1) {
    if (block[index] === "`") code = !code;
    if (
      !code &&
      /[.!?]/.test(block[index]!) &&
      /\s/.test(block[index + 1] ?? "")
    ) {
      parts.push(block.slice(start, index + 1));
      start = index + 1;
    }
  }
  if (block.slice(start).trim()) parts.push(block.slice(start));
  return parts;
}

/** Git includes authored untracked files while excluding ignored build output. */
export async function currentDocs(root: string): Promise<DocStatement[]> {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "*.md",
    ],
    { cwd: root, encoding: "utf8" },
  );
  const result: DocStatement[] = [];
  for (const file of new Set(files.split("\0").filter(isCurrentDoc)))
    result.push(
      ...docStatements(file, await fs.readFile(path.join(root, file), "utf8")),
    );
  return result;
}

export function isCurrentDoc(file: string): boolean {
  return (
    !/^(?:plans\/|docs\/reviews\/)/.test(file) &&
    !/(?:^|\/)CHANGELOG\.md$/i.test(file) &&
    (file.startsWith("docs/") || /(?:^|\/)(?:README|notes)\.md$/i.test(file))
  );
}

/** Paragraphs, list items, table rows and fenced examples are exact review units. */
export function docStatements(file: string, source: string): DocStatement[] {
  const result: DocStatement[] = [];
  let pending: string[] = [];
  let start = 0;
  let deliveryLevel = 0;
  let fence: string | undefined;
  let skipLine = -1;
  const flush = () => {
    let line = start + 1;
    for (const part of statementParts(pending.join("\n"))) {
      result.push({
        file,
        line: line + (part.match(/^\s*/)?.[0].match(/\n/g)?.length ?? 0),
        text: normalizeStatement(part),
        delivery: deliveryLevel > 0,
      });
      line += part.match(/\n/g)?.length ?? 0;
    }
    pending = [];
  };
  const lines = source.split("\n");
  for (const [index, line] of lines.entries()) {
    if (index === skipLine) continue;
    if (fence) {
      pending.push(line);
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) {
        fence = undefined;
        flush();
      }
      continue;
    }
    const setext =
      line.trim() && /^ {0,3}(=+|-+)\s*$/.exec(lines[index + 1] ?? "");
    const heading =
      /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line) ??
      (setext ? [line, setext[1]![0] === "=" ? "#" : "##", line.trim()] : null);
    if (setext) skipLine = index + 1;
    if (heading) {
      flush();
      if (heading[1]!.length <= deliveryLevel) deliveryLevel = 0;
      if (heading[2] === "Delivery Status" && !file.startsWith("docs/guides/"))
        deliveryLevel = heading[1]!.length;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (
      !line.trim() ||
      heading ||
      opening ||
      /^\s*(?:[-*+] |\d+[.)] |\|)/.test(line)
    )
      flush();
    if (!line.trim()) continue;
    if (!pending.length) start = index;
    pending.push(line);
    if (opening) fence = opening[1];
    if (heading) flush();
  }
  flush();
  return result;
}

/** Current format names do not exempt other version claims in the same statement. */
export function restrictedStatement(text: string): boolean {
  text = normalizeStatement(text);
  if (
    /\b(?:manifest[ -](?:schema[ -])?v[1-8]|v[1-8][ -]manifest|schema[ -]v[1-8]|(?:catalogue(?: read model)?|read model)[ -]v[1-4]|(?:comparison(?: result)?|review(?:[ -]result)?)[ -]v[1-5]|v[1-5][ -](?:comparison|review result))\b/i.test(
      text,
    )
  )
    return true;
  const currentNames =
    /\b(?:manifest[ -](?:schema )?v9|catalogue[ -](?:read model )?v5|read model v5|(?:comparison(?: result)?|review(?:[ -]result)?) (?:is )?v6|(?:ReviewResultV|ScreenReviewV)6|(?:public|catalogue) v5|v6 (?:comparison|result|reason|assembly)|v5 (?:model|catalogues?|fixture|fields)|read model remains v5|review result schema is v6)\b/gi;
  const independentNames =
    /\b(?:Tailwind v4|actions\/(?:checkout|setup-node)@v6|(?:catalogue )?upload(?: exchange| validation)?[ -]v1|(?:export[ -])?ownership[ -]v3|(?:wire|inspector)[ -]protocol[ -]v2|delivery(?: descriptors?)?(?: remain)? v5|(?:private )?catalogue-change snapshot is v3|removed page preview metadata is v3)\b/gi;
  const value = normalizeStatement(text)
    .replace(currentNames, "")
    .replace(independentNames, "")
    .replace(/\bnpm run dependencies:check\b/g, "")
    .replace(/https:\/\/api\.mokly\.ai\/v1\//g, "")
    .replace(/\bv\d+\.\d+\.\d+\b/g, "");
  return (
    /(?:validates any missing configured neighbour|planned diagnostic channel|remaining review fixes|current code rejects the removed field|builds the local CLI, generates the catalogue, and watches entries)/i.test(
      value,
    ) ||
    /\b(?:v[1-8]|(?:ManifestV|ReviewResultV|ScreenReviewV)[1-8]|version [1-8] manifest)\b/i.test(
      value,
    ) ||
    /\b(?:ownedDependencies|declaredDependencies|sharedImpact)\b|`(?:[a-zA-Z]+\.)?dependencies`|["']dependencies["']\s*:|\bentry['’]s dependencies|\bdependencies\s*\??\s*:|\bdependencies has been removed|\bentry\s+dependencies\b|\bshared[ -]impact\s+(?:paths?|files|patterns?|globs?|evidence|reasons)\b/i.test(
      value,
    ) ||
    /\bmilestones?\b|\bM\d+[A-Z]?\b|(?:^|[./])plans\/|\b(?:implementation|current|source-path removal|delivery|review.fix)\s+plans?\b/i.test(
      value,
    )
  );
}

export function docsFindings(
  statements: readonly DocStatement[],
  exceptions: readonly DocException[],
): string[] {
  const used = new Set<DocException>();
  const findings: string[] = [];
  for (const statement of statements) {
    if (statement.delivery || !restrictedStatement(statement.text)) continue;
    const exception = exceptions.find(
      (entry) =>
        entry.file === statement.file &&
        normalizeStatement(entry.statement) === statement.text &&
        entry.reason.trim(),
    );
    if (exception) used.add(exception);
    else
      findings.push(`${statement.file}:${statement.line}: ${statement.text}`);
  }
  for (const entry of exceptions)
    if (!used.has(entry))
      findings.push(
        `Unused documentation exception: ${entry.file}: ${entry.statement}`,
      );
  return findings;
}
