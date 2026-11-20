import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import postcss from "postcss";
import valueParser from "postcss-value-parser";
import ts from "typescript";

const sourceExtension = /\.(?:[cm]?[jt]sx?)$/;
const cloudPath = (file) =>
  /^(?:apps(?:\/|$)|packages\/tokens(?:\/|$))/.test(file);

/** Read manifest dependencies and resolve source imports at the MIT boundary. */
export function violationsFor({ files, read, resolve, root }) {
  const manifests = files.filter((file) => file.endsWith("/package.json"));
  const cloudNames = new Set(
    manifests.filter(cloudPath).map((file) => JSON.parse(read(file)).name),
  );
  const violations = [];
  const protectedFile = (file) =>
    file.startsWith("packages/") && !cloudPath(file);
  const targetIsCloud = (file, specifier) => {
    if (
      [...cloudNames].some(
        (name) => specifier === name || specifier.startsWith(`${name}/`),
      )
    )
      return true;
    const resolved = resolve(file, specifier);
    return (
      resolved &&
      cloudPath(path.relative(root, resolved).split(path.sep).join("/"))
    );
  };
  for (const file of files.filter(protectedFile)) {
    if (file.endsWith("/package.json")) {
      const manifest = JSON.parse(read(file));
      for (const category of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        for (const [name, version] of Object.entries(
          manifest[category] ?? {},
        )) {
          const alias = version.match(/^npm:((?:@[^/]+\/)?[^@]+)/)?.[1];
          const local = version.replace(/^(?:file|link):/, "");
          if (
            targetIsCloud(file, name) ||
            (alias && targetIsCloud(file, alias)) ||
            (local !== version &&
              targetIsCloud(
                file,
                path.isAbsolute(local) || local.startsWith(".")
                  ? local
                  : `./${local}`,
              ))
          ) {
            violations.push(
              `${file}: ${category}.${name} depends on AGPL source ${version}`,
            );
          }
        }
      }
    } else if (file.endsWith(".css")) {
      postcss
        .parse(read(file), { from: file })
        .walkAtRules("import", (rule) => {
          const value = valueParser(rule.params).nodes[0];
          const target =
            value?.type === "function" && value.value === "url"
              ? value.nodes[0]?.value
              : value?.value;
          if (target && targetIsCloud(file, target))
            violations.push(`${file}: import depends on AGPL source ${target}`);
        });
    } else if (sourceExtension.test(file)) {
      const source = ts.createSourceFile(
        file,
        read(file),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node) => {
        let specifier;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
          specifier = node.moduleSpecifier;
        if (
          ts.isImportEqualsDeclaration(node) &&
          ts.isExternalModuleReference(node.moduleReference)
        )
          specifier = node.moduleReference.expression;
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
          specifier = node.argument.literal;
        if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) &&
              node.expression.text === "require"))
        )
          specifier = node.arguments[0];
        if (
          specifier &&
          ts.isStringLiteralLike(specifier) &&
          targetIsCloud(file, specifier.text)
        ) {
          violations.push(
            `${file}: import depends on AGPL source ${specifier.text}`,
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return violations;
}

function main() {
  const root = process.cwd();
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter((file) => file && fs.existsSync(file));
  const configs = new Map();
  const resolve = (file, specifier) => {
    const directory = path.dirname(path.resolve(root, file));
    if (specifier.startsWith(".") || path.isAbsolute(specifier))
      return path.resolve(directory, specifier);
    const configPath = ts.findConfigFile(directory, ts.sys.fileExists);
    if (!configs.has(configPath)) {
      const config = configPath
        ? ts.readConfigFile(configPath, ts.sys.readFile)
        : { config: {} };
      if (config.error)
        throw new Error(
          ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
        );
      configs.set(
        configPath,
        ts.parseJsonConfigFileContent(
          config.config,
          ts.sys,
          configPath ? path.dirname(configPath) : root,
        ).options,
      );
    }
    return ts.resolveModuleName(
      specifier,
      path.resolve(root, file),
      configs.get(configPath),
      ts.sys,
    ).resolvedModule?.resolvedFileName;
  };
  const violations = violationsFor({
    files,
    root,
    resolve,
    read: (file) => fs.readFileSync(file, "utf8"),
  });
  if (violations.length) throw new Error(violations.join("\n"));
  console.log(
    "MIT package manifests and imports do not depend on cloud source.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
