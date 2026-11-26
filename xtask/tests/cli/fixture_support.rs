//! Isolated roots for the real Mokly contract fixture generator.

use std::fs;
use std::path::Path;

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, repository};

/// The fixture generator entry point in each temporary repository.
pub(super) const GENERATOR: &str = "xtask/scripts/mokly-fixtures.mjs";
/// Contract fixture sources and generated files in each repository.
pub(super) const FIXTURES: &str = "crates/mkc-mokly-contract/fixtures";

/// Prepare the real generator and its inputs in a private repository.
pub(super) fn prepared() -> Box<dyn Fixture> {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    fixture
}

/// Copy the output files as bytes so each check can edit its own directory.
pub(super) fn with_output(root: &Path) -> Box<dyn Fixture> {
    let fixture = prepared();
    let destination = fixture.root().join(FIXTURES);
    for entry in fs::read_dir(root.join(FIXTURES)).unwrap() {
        let entry = entry.unwrap();
        if entry.file_type().unwrap().is_file() {
            fs::copy(entry.path(), destination.join(entry.file_name())).unwrap();
        }
    }
    fixture
}

/// Copy the generator inputs and link the built workspace tools.
pub(super) fn prepare(fixture: &dyn Fixture) {
    fixture.tools();
    fixture.link("packages", &repository().join("packages"));
    for name in [
        "export-ownership-v3.json",
        "upload-plan-v1.json",
        "catalogue-v9.json",
    ] {
        fixture.copy(&format!("docs/protocol/fixtures/{name}"));
    }
    fixture.copy(GENERATOR);
    fixture.copy("xtask/scripts/mokly-cli-errors.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-runtime.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-upload.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-artifacts.mjs");
    fixture.copy("xtask/scripts/mokly-fixture-normalize.mjs");
    fixture.write("package.json", "{\"private\":true,\"type\":\"module\"}\n");
    fixture.copy_tree(&format!("{FIXTURES}/src"));
    fixture.copy_tree(&format!("{FIXTURES}/moves/src"));
    fixture.copy(&format!("{FIXTURES}/index-v9-cases.json"));
    fixture.copy(&format!("{FIXTURES}/check-index-corpus.mjs"));
    fixture.copy(&format!("{FIXTURES}/index-corpus.mjs"));
}
