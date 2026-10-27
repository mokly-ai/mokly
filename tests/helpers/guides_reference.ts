import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { repositoryRoot } from "./fixture.js";

/** One option as the CLI help prints it. */
export interface CliOption {
  long: string;
  short: string | undefined;
  value: boolean;
}

/** Commands and options of the built CLI. The key "" is the command-less form. */
export interface CliSurface {
  commands: readonly string[];
  options: ReadonlyMap<string, readonly CliOption[]>;
}

/**
 * One object of the configuration schema, labelled with its field path. The
 * object items of an array field share the label of the field.
 */
export interface ConfigObject {
  label: string;
  properties: readonly string[];
}

const moklyPackage = path.join(repositoryRoot, "packages", "mokly");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function help(command: string): string {
  const shim = path.join(moklyPackage, "bin", "mokly.mjs");
  const result = spawnSync(
    process.execPath,
    [shim, command, "--help"].filter(Boolean),
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      `mokly ${command} --help failed. Run npm run build first.\n${result.stderr}`,
    );
  return result.stdout;
}

/** The indented lines of one help section, such as `Options:`. */
function helpSection(text: string, title: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(title);
  if (start < 0) throw new Error(`The help has no ${title} section`);
  const end = lines.findIndex(
    (line, index) => index > start && line !== "" && !line.startsWith(" "),
  );
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/**
 * Parse the flags of one option line, such as `-h, --help` or
 * `--config <CONFIG>`. A description line returns nothing.
 */
export function helpOption(line: string): CliOption | undefined {
  const flags = line.trim().split("  ")[0] ?? "";
  if (!flags.startsWith("-")) return undefined;
  const option: CliOption = { long: "", short: undefined, value: false };
  for (const flag of flags.split(", ")) {
    const [name = "", placeholder] = flag.split(" ");
    if (name.startsWith("--")) {
      option.long = name;
      option.value = placeholder !== undefined;
    } else option.short = name;
  }
  return option;
}

/** Read the commands and the options of each command from the built CLI. */
export function cliSurface(): CliSurface {
  const root = help("");
  const commands = helpSection(root, "Commands:")
    .map((line) => line.trim().split(" ")[0] ?? "")
    .filter(Boolean);
  const options = new Map<string, readonly CliOption[]>();
  for (const command of ["", ...commands])
    options.set(
      command,
      helpSection(command ? help(command) : root, "Options:").flatMap(
        (line) => helpOption(line) ?? [],
      ),
    );
  return { commands, options };
}

/** Every object with declared properties in the configuration schema. */
export function configObjects(): ReadonlyMap<string, ConfigObject> {
  const schema: unknown = JSON.parse(
    readFileSync(path.join(moklyPackage, "config.schema.json"), "utf8"),
  );
  const found = new Map<string, ConfigObject>();
  const visit = (node: unknown, label: string) => {
    if (!isRecord(node)) return;
    if (isRecord(node.properties)) {
      found.set(label, { label, properties: Object.keys(node.properties) });
      for (const [name, child] of Object.entries(node.properties))
        visit(child, label ? `${label}.${name}` : name);
    }
    visit(node.items, label);
  };
  visit(schema, "");
  return found;
}

function moduleExports(declarations: string): Set<string> {
  const program = ts.createProgram([declarations], {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
  const source = program.getSourceFile(declarations);
  const checker = program.getTypeChecker();
  const module = source && checker.getSymbolAtLocation(source);
  if (!module)
    throw new Error(`${declarations} is missing. Run npm run build first.`);
  return new Set(checker.getExportsOfModule(module).map(({ name }) => name));
}

/** The names exported at each `@mokly/mokly` subpath, read from its declarations. */
export function packageExports(): ReadonlyMap<string, ReadonlySet<string>> {
  const manifest: unknown = JSON.parse(
    readFileSync(path.join(moklyPackage, "package.json"), "utf8"),
  );
  if (!isRecord(manifest) || !isRecord(manifest.exports))
    throw new Error("packages/mokly/package.json has no exports map");
  const subpaths = new Map<string, ReadonlySet<string>>();
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    const types = isRecord(target) ? target.types : undefined;
    subpaths.set(
      subpath,
      typeof types === "string"
        ? moduleExports(path.join(moklyPackage, types))
        : new Set(),
    );
  }
  return subpaths;
}
