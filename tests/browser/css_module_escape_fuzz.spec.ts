import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import { scopeModule } from "../../dist/build/styles/modules.js";
import { pluginModuleOutput } from "../helpers/css_module_plugin_output.js";
import { startDuration } from "../helpers/durations.js";

const seed = 0x30c55e1;
const count = 600;
const relative = "entries/escape-fuzz.module.css";
const prefix = `mokly_${createHash("sha256").update(relative).digest("hex").slice(0, 12)}_`;
let state = seed;
function next(): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}
function pick<T>(choices: readonly T[]): T {
  return choices[next() % choices.length]!;
}

const escapes = [
  "\\31",
  "\\000031",
  "\\6a",
  "\\00006a",
  "\\4A",
  "\\4a",
  "\\00004A",
  "\\62",
] as const;
const endings = ["", "", " ", "\t", "\n"] as const;
const connectors = [" ", ">", "\n", "\t", "\f", " /**/ ", "/**/"] as const;
const separators = [",", ", ", " ,", ",\n"] as const;
const tails = ["", "", ",", ", ", ",,", ", ,", ",/**/"] as const;

function escapedName(): string {
  const base = pick(["a", "b", "xy"]);
  const escape = pick(escapes);
  return `${base}${escape}${pick(endings)}`;
}

function item(): string {
  const first = `${pick([".", "#"])}${escapedName()}`;
  return next() % 3 === 0
    ? `${first}${pick([".tail", ":hover", "[x]"])}`
    : first;
}

function selector(): string {
  const mode = pick([":global", ":local"]);
  const first = item();
  const second = next() % 2 === 0 ? `${pick(separators)}${item()}` : "";
  const wrapper = `${mode}(${first}${second}${pick(tails)})`;
  const part =
    next() % 3 === 0
      ? `${pick([":is", ":where", ":not"])}(${wrapper})`
      : wrapper;
  return `${pick([".root", "#root"])}${pick(connectors)}${part}${pick(["", ".last", ":hover"])}`;
}

function literalNames(css: string): string {
  let result = "";
  for (let index = 0; index < css.length;) {
    if (css.slice(index, index + 2) === "/*") {
      const end = css.indexOf("*/", index + 2);
      const nextIndex = end < 0 ? css.length : end + 2;
      result += css.slice(index, nextIndex);
      index = nextIndex;
      continue;
    }
    if (css[index] === "\\") {
      const match = /^\\([0-9a-fA-F]{1,6})/u.exec(css.slice(index));
      if (match) {
        let nextIndex = index + match[0].length;
        if (css[nextIndex] === "\r" && css[nextIndex + 1] === "\n")
          nextIndex += 2;
        else if ([" ", "\t", "\n", "\r", "\f"].includes(css[nextIndex] ?? ""))
          nextIndex += 1;
        result += String.fromCodePoint(Number.parseInt(match[1]!, 16));
        index = nextIndex;
        continue;
      }
    }
    result += css[index];
    index += 1;
  }
  return result;
}

test(`seeded CSS Modules escape-and-wrapper oracle (seed ${seed})`, async ({
  page,
}) => {
  const duration = startDuration();
  const rows: {
    name: string;
    delivered: string;
    reference: string;
    accepted: boolean;
    error?: string;
  }[] = [];
  for (let index = 0; index < count; index += 1) {
    const source = `${selector()}{color:red}`;
    const reference = pluginModuleOutput(
      literalNames(source),
      relative,
      prefix,
    ).css.replaceAll(prefix, "");
    let delivered: string;
    let error: string | undefined;
    try {
      delivered = scopeModule(source, relative).css.replaceAll(prefix, "");
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
      delivered = pluginModuleOutput(source, relative, prefix).css.replaceAll(
        prefix,
        "",
      );
    }
    rows.push({
      name: `${index}/${source}`,
      delivered,
      reference,
      accepted: error === undefined,
      ...(error ? { error } : {}),
    });
  }
  const parsed: { delivered: string | null; reference: string | null }[] = [];
  for (let index = 0; index < rows.length; index += 100)
    parsed.push(
      ...(await page.evaluate(
        (batch) =>
          batch.map((row) => {
            const read = (css: string) => {
              const sheet = new CSSStyleSheet();
              try {
                sheet.replaceSync(css);
              } catch {
                return null;
              }
              return (
                (sheet.cssRules[0] as CSSStyleRule | undefined)?.selectorText ??
                null
              );
            };
            return {
              delivered: read(row.delivered),
              reference: read(row.reference),
            };
          }),
        rows.slice(index, index + 100),
      )),
    );

  const rejected = new Map<string, number>();
  let accepted = 0;
  let tolerated = 0;
  for (const [index, row] of rows.entries()) {
    const result = parsed[index]!;
    expect(result.reference, `${row.name}: reference parses`).not.toBeNull();
    expect(result.delivered, `${row.name}: delivered parses`).not.toBeNull();
    if (row.accepted) {
      accepted += 1;
      expect(result.delivered, row.name).toBe(result.reference);
    } else {
      const category = row.error!.includes("cannot safely scope an escape")
        ? "escape"
        : row.error!.includes("scoping would change more than local names")
          ? "scoping"
          : "other";
      rejected.set(category, (rejected.get(category) ?? 0) + 1);
      if (result.delivered === result.reference) {
        // This generator puts trailing commas only in wrappers, never in the
        // non-wrapper pseudo-class strict-rejection shape.
        expect(category, row.name).toBe("escape");
        tolerated += 1;
      }
    }
  }
  test.info().annotations.push({
    type: "fuzz",
    description: `${rows.length} generated; ${accepted} accepted; ${JSON.stringify(Object.fromEntries(rejected))} rejected; ${tolerated} tolerated escape errors; ${duration()}`,
  });
});
