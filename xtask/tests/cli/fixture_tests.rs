//! Real CLI fixture regeneration, deterministic drift rejection, and isolation.

use std::fs;

use serde_json::{Value, json};

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, repository, success};

#[test]
fn fixture_runtime_resolves_private_root_symlinks_and_rejects_escapes() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    fixture.copy("xtask/scripts/mokly-fixture-runtime.mjs");
    fixture.write("private-root/.keep", "");
    fixture.write("outside-root/.keep", "");
    fixture.link("private-link", &fixture.root().join("private-root"));
    success(fixture.run(
        "node",
        &[
            "--input-type=module",
            "--eval",
            r#"import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixtureRuntime } from './xtask/scripts/mokly-fixture-runtime.mjs';
const runtime = await fixtureRuntime(process.cwd(), resolve('private-link'));
const cache = (path) => runtime.run(process.execPath,
  ['-e', "console.log('Mokly cache: ' + process.argv[1])", path], process.cwd());
mkdirSync('private-link/runtime/cache/inside');
const inside = realpathSync('private-link/runtime/cache/inside');
assert.equal(cache(inside), `Mokly cache: ${inside}`);
const outside = realpathSync('outside-root');
assert.throws(() => cache(outside), {
  code: 'ERR_ASSERTION', message: /^CLI state escaped its private root:/,
});
const escape = resolve('private-link/runtime/cache/escape');
symlinkSync(outside, escape, 'dir');
assert.throws(() => cache(escape), {
  code: 'ERR_ASSERTION', message: /^CLI state escaped its private root:/,
});"#,
        ],
    ));
}

#[test]
fn missing_fixture_dependencies_explain_how_to_install_them() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    fixture.copy("xtask/scripts/mokly-fixtures.mjs");
    fixture.write("package.json", "{\"private\":true,\"type\":\"module\"}\n");
    failure(
        fixture.run("node", &["xtask/scripts/mokly-fixtures.mjs", "--check"]),
        "npm ci",
    );
}

#[test]
fn fixture_generation_rejects_a_stale_workspace_cli_before_normalizing_versions() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    prepare(fixture.as_ref());
    fs::remove_file(fixture.root().join("packages")).unwrap();
    fixture.copy("packages/mokly/package.json");
    fixture.link(
        "packages/mokly/bin",
        &repository().join("packages/mokly/bin"),
    );
    let path = "packages/mokly/package.json";
    let mut package: Value =
        serde_json::from_slice(&fs::read(fixture.root().join(path)).unwrap()).unwrap();
    package["version"] = json!("99.0.0");
    fixture.write(path, &serde_json::to_string(&package).unwrap());
    failure(
        fixture.run("node", &["xtask/scripts/mokly-fixtures.mjs"]),
        "Mokly version differs from the workspace",
    );
}

#[test]
fn fixture_generator_reproduces_output_and_cli_rejects_changed_missing_extra_files() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    prepare(fixture.as_ref());
    let generator = "xtask/scripts/mokly-fixtures.mjs";
    let metadata: Value = serde_json::from_slice(
        &fs::read(repository().join("crates/mkc-mokly-contract/fixtures/checksums.json")).unwrap(),
    )
    .unwrap();
    success(fixture.run("node", &[generator]));
    for name in [
        "mokly-upload.json",
        "moves-mokly-upload.json",
        "cli-errors.json",
        "checksums.json",
        "moves-checksums.json",
    ] {
        let path = fixture
            .root()
            .join("crates/mkc-mokly-contract/fixtures")
            .join(name);
        let value: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(value["moklyVersion"], metadata["moklyVersion"], "{name}");
    }
    success(fixture.run("node", &[generator, "--check"]));
    fixture.write(
        "docs/mockups/src/entries/unrelated.mockup.tsx",
        "invalid unrelated source",
    );
    fixture.write("mokly.config.json", "invalid unrelated config");
    success(fixture.run("node", &[generator, "--check"]));
    assert!(
        !fixture
            .root()
            .join("mokly-static/mokly-viewer/index.json")
            .exists()
    );
    for path in [
        "crates/mkc-mokly-contract/fixtures/mokly-upload.json",
        "crates/mkc-mokly-contract/fixtures/cli-errors.json",
    ] {
        let original = fs::read_to_string(fixture.root().join(path)).unwrap();
        fixture.write(path, "{}\n");
        failure(
            fixture.run("node", &[generator, "--check"]),
            "Mokly fixture drift",
        );
        fixture.write(path, &original);
        fs::remove_file(fixture.root().join(path)).unwrap();
        failure(
            fixture.run("node", &[generator, "--check"]),
            path.rsplit('/').next().unwrap(),
        );
        fixture.write(path, &original);
    }
    fixture.write("crates/mkc-mokly-contract/fixtures/extra.json", "{}\n");
    failure(fixture.run("node", &[generator, "--check"]), "extra.json");
}

#[test]
fn fixture_generation_is_identical_from_different_absolute_roots() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let first = factory.create();
    let second = factory.create();
    assert_ne!(first.root(), second.root());
    for fixture in [&first, &second] {
        prepare(fixture.as_ref());
        success(fixture.run("node", &["xtask/scripts/mokly-fixtures.mjs"]));
    }
    assert!(
        !first
            .root()
            .join("crates/mkc-mokly-contract/fixtures/src/mokly-static")
            .exists()
    );
    for name in [
        "cli-errors.json",
        "mokly-upload.json",
        "inventory.json",
        "index-v9.json",
        "dogfood.tar.gz",
        "plan.tar.gz",
        "checksums.json",
        "export-ownership-v3.json",
        "upload-plan-v1.json",
        "catalogue-v9.json",
        "moves-index-v9.json",
        "moves-inventory.json",
        "moves-mokly-upload.json",
        "moves-plan.tar.gz",
        "moves-export.tar.gz",
        "moves-checksums.json",
    ] {
        let path = format!("crates/mkc-mokly-contract/fixtures/{name}");
        assert!(
            fs::read(first.root().join(&path)).unwrap()
                == fs::read(second.root().join(&path)).unwrap(),
            "path-dependent {name}"
        );
    }
}

#[test]
fn fixture_check_refuses_counts_the_public_reader_disagrees_with() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    prepare(fixture.as_ref());
    let generator = "xtask/scripts/mokly-fixtures.mjs";
    success(fixture.run("node", &[generator]));
    let path = "crates/mkc-mokly-contract/fixtures/index-v9-cases.json";
    let original = fs::read_to_string(fixture.root().join(path)).unwrap();
    let mut corpus: Value = serde_json::from_str(&original).unwrap();
    corpus["cases"][0]["counts"]["changed"] = json!(999);
    fixture.write(path, &serde_json::to_string_pretty(&corpus).unwrap());
    success(fixture.run("node", &[generator]));
    failure(
        fixture.run("node", &[generator, "--check"]),
        "Viewer counts differ: baseline-counts",
    );
}

#[test]
fn fixture_check_refuses_cloud_acceptance_of_viewer_invalid_input() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    prepare(fixture.as_ref());
    let generator = "xtask/scripts/mokly-fixtures.mjs";
    success(fixture.run("node", &[generator]));
    let path = "crates/mkc-mokly-contract/fixtures/index-v9-cases.json";
    let mut corpus: Value =
        serde_json::from_str(&fs::read_to_string(fixture.root().join(path)).unwrap()).unwrap();
    corpus["cases"][0]["patch"] = json!([{ "op": "set", "path": "/schemaVersion", "value": 8 }]);
    fixture.write(path, &serde_json::to_string_pretty(&corpus).unwrap());
    success(fixture.run(
        "node",
        &[
            "--input-type=module",
            "--eval",
            r#"import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { caseDocument } from './crates/mkc-mokly-contract/fixtures/index-corpus.mjs';
const path = process.argv[1];
const corpus = JSON.parse(await readFile(path, 'utf8'));
const test = corpus.cases[0];
test.documentSha256 = createHash('sha256').update(caseDocument(corpus.baseDocument, test)).digest('hex');
await writeFile(path, JSON.stringify(corpus, null, 2) + '\n');"#,
            path,
        ],
    ));
    success(fixture.run("node", &[generator]));
    failure(
        fixture.run("node", &[generator, "--check"]),
        "Viewer refused cloud-accepted case: baseline-counts",
    );
}

fn prepare(fixture: &dyn Fixture) {
    fixture.tools();
    fixture.link("packages", &repository().join("packages"));
    for name in [
        "export-ownership-v3.json",
        "upload-plan-v1.json",
        "catalogue-v9.json",
    ] {
        fixture.copy(&format!("docs/protocol/fixtures/{name}"));
    }
    fixture.copy("xtask/scripts/mokly-fixtures.mjs");
    fixture.copy("xtask/scripts/mokly-cli-errors.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-runtime.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-upload.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-artifacts.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-normalize.mjs");
    fixture.write("package.json", "{\"private\":true,\"type\":\"module\"}\n");
    copy_sources(fixture, "crates/mkc-mokly-contract/fixtures/src");
    copy_sources(fixture, "crates/mkc-mokly-contract/fixtures/moves/src");
    fixture.copy("crates/mkc-mokly-contract/fixtures/index-v9-cases.json");
    fixture.copy("crates/mkc-mokly-contract/fixtures/check-index-corpus.mjs");
    fixture.copy("crates/mkc-mokly-contract/fixtures/index-corpus.mjs");
}

fn copy_sources(fixture: &dyn Fixture, path: &str) {
    for entry in fs::read_dir(repository().join(path)).unwrap() {
        let entry = entry.unwrap();
        let child = format!("{path}/{}", entry.file_name().to_str().unwrap());
        if entry.file_type().unwrap().is_dir() {
            copy_sources(fixture, &child);
        } else {
            fixture.copy(&child);
        }
    }
}
