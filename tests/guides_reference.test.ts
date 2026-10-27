/**
 * Compares guide reference content with the shipped interface. The guides are
 * parsed as Markdown and TypeScript. The interface comes from the built CLI
 * help, the configuration schema, and the package declarations. No check
 * matches prose sentences or source text with regular expressions.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  type GuideTable,
  guideContent,
  guideImports,
  moklyCommandLines,
} from "./helpers/guides_content.js";
import {
  type CliOption,
  type CliSurface,
  type ConfigObject,
  cliSurface,
  configObjects,
  helpOption,
  packageExports,
} from "./helpers/guides_reference.js";

/** The options page documents these for every command. */
const SHARED_OPTIONS = new Set(["--help", "--version"]);
/** Guides whose `Field` tables document `mokly.config.json`. */
const CONFIGURATION_GUIDES = new Set(["authoring/config"]);
/** `$schema` points an editor at the schema and configures nothing. */
const EDITOR_FIELDS = new Set(["$schema"]);
const PACKAGE = "@mokly/mokly";

const content = guideContent();
let surface: CliSurface | undefined;

function cli(): CliSurface {
  surface ??= cliSurface();
  return surface;
}

function tables(firstHeader: string): GuideTable[] {
  return content.tables.filter(({ header }) => header[0]?.text === firstHeader);
}

function column(table: GuideTable, title: string): number {
  return table.header.findIndex(({ text }) => text === title);
}

function label(table: GuideTable): string {
  return `${table.id} "${table.heading}"`;
}

/** The option of each row's first cell, such as `--config {path}` or `--help`, `-h`. */
function documentedOptions(table: GuideTable): CliOption[] {
  return table.rows.map((row) => {
    const option = helpOption((row[0]?.code ?? []).join(", "));
    assert.ok(option?.long, `${label(table)} has a row without an option`);
    return option;
  });
}

function assertOptions(
  table: GuideTable,
  expected: readonly CliOption[],
  source: string,
): CliOption[] {
  const documented = documentedOptions(table);
  assert.deepEqual(
    documented.map(({ long }) => long).sort(),
    expected.map(({ long }) => long).sort(),
    `${label(table)} must list exactly the options of ${source}`,
  );
  for (const option of documented)
    assert.deepEqual(
      option,
      expected.find(({ long }) => long === option.long),
      `${label(table)}: ${option.long} must match its value and short form in ${source}`,
    );
  return documented;
}

test("each command reference lists exactly the options of its command", () => {
  const { commands, options } = cli();
  assert.ok(commands.length > 0, "the CLI help lists no commands");
  for (const command of commands)
    assert.equal(
      tables("Option").filter(({ id }) => id === `cli/${command}`).length,
      1,
      `cli/${command} must have one option table`,
    );
  for (const table of tables("Option")) {
    if (column(table, "Commands") >= 0) continue;
    const command = table.id.slice("cli/".length);
    assert.ok(
      table.id.startsWith("cli/") && commands.includes(command),
      `${label(table)} documents the options of no command`,
    );
    assertOptions(
      table,
      (options.get(command) ?? []).filter(
        ({ long }) => !SHARED_OPTIONS.has(long),
      ),
      `mokly ${command} --help`,
    );
  }
});

test("the options table names the commands that accept each option", () => {
  const { commands, options } = cli();
  const accepting = new Map<string, string[]>();
  const every: CliOption[] = [];
  for (const command of commands)
    for (const option of options.get(command) ?? []) {
      if (!accepting.has(option.long)) every.push(option);
      accepting.set(option.long, [
        ...(accepting.get(option.long) ?? []),
        command,
      ]);
    }
  const pages = tables("Option").filter(
    (table) => column(table, "Commands") >= 0,
  );
  assert.ok(pages.length > 0, "no guide has an option table with commands");
  for (const table of pages) {
    const documented = assertOptions(table, every, "the command help");
    for (const [index, row] of table.rows.entries()) {
      const cell = row[column(table, "Commands")];
      const long = documented[index]?.long ?? "";
      assert.deepEqual(
        (cell?.text === "all" ? [...commands] : [...(cell?.code ?? [])]).sort(),
        [...(accepting.get(long) ?? [])].sort(),
        `${label(table)}: ${long} must name the commands that accept it`,
      );
    }
  }
});

/** The arguments that the selected command, or command-less Serve, rejects. */
function rejectedArguments(words: readonly string[]): string[] {
  const { commands, options } = cli();
  const command = commands.includes(words[0] ?? "") ? (words[0] ?? "") : "";
  const accepted = options.get(command) ?? [];
  const rejected: string[] = [];
  let value = false;
  for (const word of command ? words.slice(1) : words) {
    if (value) {
      value = false;
      continue;
    }
    const flag = word.split("=")[0] ?? "";
    const option = accepted.find(({ long, short }) =>
      [long, short].includes(flag),
    );
    if (option) value = option.value && !word.includes("=");
    else rejected.push(word);
  }
  return rejected;
}

test("guide command lines use only the options of their command", () => {
  const lines = moklyCommandLines(content, cli().commands);
  assert.ok(lines.length > 0, "no guide shows a mokly command line");
  for (const line of lines)
    assert.deepEqual(
      rejectedArguments(line.words),
      [],
      `${line.id}: "${line.text}" passes arguments that its command help does not list`,
    );
});

function owner(
  objects: readonly ConfigObject[],
  table: GuideTable,
  fields: readonly string[],
): ConfigObject {
  const first = new Set(fields.map((field) => field.split(".")[0]));
  const score = ({ properties }: ConfigObject) =>
    properties.filter((name) => first.has(name)).length;
  const [best, next] = [...objects].sort(
    (left, right) => score(right) - score(left),
  );
  assert.ok(
    best && score(best) > 0 && (!next || score(next) < score(best)),
    `${label(table)} documents no single object of config.schema.json`,
  );
  return best;
}

function fieldPath(parent: string, name: string): string {
  return parent ? `${parent}.${name}` : name;
}

test("configuration field tables match the configuration schema", () => {
  const objects = configObjects();
  const pages = tables("Field").filter(({ id }) =>
    CONFIGURATION_GUIDES.has(id),
  );
  assert.ok(pages.length > 0, "no configuration guide has a field table");
  for (const table of pages) {
    const fields = table.rows.flatMap((row) => row[0]?.code ?? []);
    const object = owner([...objects.values()], table, fields);
    const where = object.label || "the root object";
    for (const field of fields) {
      let parent = object.label;
      for (const segment of field.split(".")) {
        assert.ok(
          objects.get(parent)?.properties.includes(segment),
          `${label(table)} lists ${field}, which config.schema.json does not define in ${where}`,
        );
        parent = fieldPath(parent, segment);
      }
    }
    for (const property of object.properties) {
      if (EDITOR_FIELDS.has(property)) continue;
      const expanded = fields.some((field) => field.startsWith(`${property}.`));
      const nested =
        objects.get(fieldPath(object.label, property))?.properties ?? [];
      for (const field of expanded
        ? nested.map((name) => `${property}.${name}`)
        : [property])
        assert.ok(
          fields.includes(field),
          `${label(table)} omits ${field}, which config.schema.json defines in ${where}`,
        );
    }
  }
});

test("guides name only exports of the authoring package", () => {
  const subpaths = packageExports();
  const root = subpaths.get(".");
  assert.ok(root?.size, `${PACKAGE} exports nothing at its root`);
  for (const table of tables("Type"))
    for (const name of table.rows.flatMap((row) => row[0]?.code ?? []))
      assert.ok(
        root.has(name),
        `${label(table)} lists ${name}, which ${PACKAGE} does not export`,
      );
  let imported = 0;
  for (const { id, names, specifier } of guideImports(content)) {
    if (specifier !== PACKAGE && !specifier.startsWith(`${PACKAGE}/`)) continue;
    const available = subpaths.get(`.${specifier.slice(PACKAGE.length)}`);
    assert.ok(
      available,
      `${id} imports ${specifier}, which ${PACKAGE} does not export`,
    );
    for (const name of names)
      assert.ok(
        available.has(name),
        `${id} imports ${name} from ${specifier}, which does not export it`,
      );
    imported += names.length;
  }
  assert.ok(imported > 0, `no guide example imports ${PACKAGE}`);
});
