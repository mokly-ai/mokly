import { Marked, type MarkedToken, type Token, type Tokens } from "marked";
import ts from "typescript";

import { GUIDES } from "./guides.js";

/** One table cell: its text and the text of each code span inside it. */
export interface GuideCell {
  code: readonly string[];
  text: string;
}

/** A Markdown table of one guide, with the nearest heading above it. */
export interface GuideTable {
  header: readonly GuideCell[];
  heading: string;
  id: string;
  rows: readonly (readonly GuideCell[])[];
}

/** A fenced code block, one of its lines, or an inline code span of a guide. */
export interface GuideCode {
  id: string;
  lang: string;
  text: string;
}

export interface GuideContent {
  fences: readonly GuideCode[];
  spans: readonly GuideCode[];
  tables: readonly GuideTable[];
}

/** A `mokly` command line of a guide, split into its arguments. */
export interface GuideCommandLine extends GuideCode {
  words: readonly string[];
}

/** One import declaration of a guide's code example. */
export interface GuideImport {
  id: string;
  names: readonly string[];
  specifier: string;
}

const parser = new Marked({ gfm: true });
const SHELL_LANGUAGES = new Set(["bash", "console", "sh", "shell"]);
const SCRIPT_LANGUAGES = new Set(["js", "jsx", "mjs", "ts", "tsx"]);

function isToken<K extends MarkedToken["type"]>(
  token: Token,
  type: K,
): token is Extract<MarkedToken, { type: K }> {
  return token.type === type;
}

function guideCell(cell: Tokens.TableCell): GuideCell {
  const code: string[] = [];
  parser.walkTokens(cell.tokens, (token) => {
    if (isToken(token, "codespan")) code.push(token.text);
  });
  return { code, text: cell.text };
}

/** Parse every guide body into its tables, code fences, and code spans. */
export function guideContent(): GuideContent {
  const fences: GuideCode[] = [];
  const spans: GuideCode[] = [];
  const tables: GuideTable[] = [];
  for (const guide of GUIDES) {
    const tokens = parser.lexer(guide.body);
    let heading = "";
    for (const token of tokens) {
      if (isToken(token, "heading")) heading = token.text;
      if (isToken(token, "table"))
        tables.push({
          header: token.header.map(guideCell),
          heading,
          id: guide.id,
          rows: token.rows.map((row) => row.map(guideCell)),
        });
    }
    parser.walkTokens(tokens, (token) => {
      if (isToken(token, "code"))
        fences.push({ id: guide.id, lang: token.lang ?? "", text: token.text });
      if (isToken(token, "codespan"))
        spans.push({ id: guide.id, lang: "", text: token.text });
    });
  }
  return { fences, spans, tables };
}

/** The arguments of a `mokly` command line, or nothing for another program. */
function moklyArguments(
  line: string,
  commands: readonly string[],
): string[] | undefined {
  const words = line.trim().split(/\s+/u);
  if (words[0] === "npx") {
    const program = words.indexOf("mokly");
    return program < 0 ? undefined : words.slice(program + 1);
  }
  if (words[0] === "mokly") return words.slice(1);
  if (commands.includes(words[0] ?? "") && words[1]?.startsWith("-"))
    return words;
  return undefined;
}

/**
 * The `mokly` command lines of shell fences and code spans. A code span such
 * as `build --out` names a command without the program.
 */
export function moklyCommandLines(
  content: GuideContent,
  commands: readonly string[],
): GuideCommandLine[] {
  const lines = [
    ...content.fences
      .filter(({ lang }) => SHELL_LANGUAGES.has(lang))
      .flatMap((fence) =>
        fence.text.split("\n").map((text) => ({ ...fence, text })),
      ),
    ...content.spans,
  ];
  return lines.flatMap((line) => {
    const words = moklyArguments(line.text, commands);
    return words ? [{ ...line, words }] : [];
  });
}

function fenceImports({ id, lang, text }: GuideCode): GuideImport[] {
  const source = ts.createSourceFile(
    `example.${lang}`,
    text,
    ts.ScriptTarget.Latest,
    false,
    lang.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return source.statements.filter(ts.isImportDeclaration).map((statement) => {
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    const named =
      bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
    return {
      id,
      names: [
        ...(clause?.name ? ["default"] : []),
        ...named.map((item) => (item.propertyName ?? item.name).text),
      ],
      specifier: ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : "",
    };
  });
}

/** The import declarations of every JavaScript and TypeScript example. */
export function guideImports(content: GuideContent): GuideImport[] {
  return content.fences
    .filter(({ lang }) => SCRIPT_LANGUAGES.has(lang))
    .flatMap(fenceImports);
}
