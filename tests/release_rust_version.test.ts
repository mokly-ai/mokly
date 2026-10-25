import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import { rustPackageVersionProblems } from "./helpers/rust_package_version.js";

// Cargo's unpublished crate version does not follow an npm Release Please bump.
// Every Rust package-version path must use the npm-derived shared version.
test("Rust package-version paths cannot use the independent Cargo crate version", async () => {
  const failures: string[] = [];
  for (const file of await rustFiles(path.join(repositoryRoot, "crates"))) {
    const source = await fs.readFile(file, "utf8");
    if (rustPackageVersionProblems(source).length > 0)
      failures.push(path.relative(repositoryRoot, file));
  }
  assert.deepEqual(
    failures,
    [],
    "Use the shared version derived from packages/mokly/package.json, including hello, cache keys, user-agent, and Rust test expectations.",
  );
});

async function rustFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await rustFiles(file)));
    else if (entry.isFile() && entry.name.endsWith(".rs")) result.push(file);
  }
  return result;
}

test("the version detector flags every Cargo version token and valueless clap version", () => {
  for (const source of [
    'env!("CARGO_PKG_VERSION")',
    'option_env!("CARGO_PKG_VERSION")',
    'std::env::var("CARGO_PKG_VERSION")',
    'std::env::var_os("CARGO_PKG_VERSION")',
    'env!("CARGO_PKG_VERSION_MAJOR")',
    '// env!("CARGO_PKG_VERSION")',
    "#[command(version)]",
    "#[clap(author, version, about)]",
    '#[command(\n name = "mokly",\n version,\n)]',
    "#[clap(r#version)]",
    '#[command(about = r#"help"#, version)]',
    "#[command(short_flag = '(', version)]",
    "#[command(about = { nested(1, 2) }, version)]",
  ])
    assert.ok(rustPackageVersionProblems(source).length > 0, source);
});

test("the version detector accepts an explicit package version and ignores quoted clap examples", () => {
  for (const source of [
    "#[command(version = crate::version::VERSION)]",
    '#[clap(version = env!("MOKLY_VERSION"))]',
    '#[command(about = "text, version, text")] ',
    "// #[command(version)]",
    "/* outer /* nested */ #[clap(version)] */",
    'const DOC: &str = r##"#[command(version)]"##;',
    'const DOC: &[u8] = br#"#[clap(version)]"#;',
    "#[command(about = { nested(version, other) }, version = VERSION)]",
  ])
    assert.deepEqual(rustPackageVersionProblems(source), [], source);
});
