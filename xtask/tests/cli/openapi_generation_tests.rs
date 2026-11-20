//! Real CLI generation from a tiny Rust API and the pinned TypeScript generator.

use std::fs;

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, repository, success};

const DOCUMENT: &str = "docs/api/openapi.json";
const CLIENT: &str = "packages/app/src/api/generated/schema.ts";
const SOURCE: &str = r#"{
  "openapi": "3.1.0",
  "info": {"title": "Fixture", "version": "1"},
  "paths": {},
  "components": {"schemas": {"Entry": {"type": "string", "description": "Original description."}}}
}
"#;

fn fixture() -> Box<dyn Fixture> {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    fixture.write(
        "Cargo.toml",
        "[package]\nname = \"mkc-api\"\nversion = \"0.1.0\"\nedition = \"2024\"\n",
    );
    fixture.write("src/main.rs", "fn main() { assert_eq!(std::env::args().nth(1).as_deref(), Some(\"openapi\")); print!(\"{}\", include_str!(\"../contract.json\")); }\n");
    fixture.write("contract.json", SOURCE);
    fixture.write(
        "package.json",
        r#"{"private":true,"workspaces":["packages/app"]}"#,
    );
    fixture.write("packages/app/package.json", r#"{"name":"@mokly-cloud/app","private":true,"scripts":{"api:generate":"openapi-typescript ../../docs/api/openapi.json -o src/api/generated/schema.ts"}}"#);
    fixture.tools();
    fixture.link(
        "packages/app/node_modules",
        &repository().join("packages/app/node_modules"),
    );
    success(fixture.run("cargo", &["generate-lockfile", "--offline"]));
    fixture
}

#[test]
fn generation_is_idempotent_and_checks_both_files_without_rewriting_them() {
    let fixture = fixture();
    success(fixture.xtask(&["openapi"]));
    assert_eq!(
        fs::read_to_string(fixture.root().join(DOCUMENT)).unwrap(),
        SOURCE
    );
    let client = fs::read_to_string(fixture.root().join(CLIENT)).unwrap();
    assert!(client.contains("Original description."));
    success(fixture.xtask(&["openapi", "--check"]));
    success(fixture.xtask(&["openapi", "--check"]));
    success(fixture.xtask(&["openapi"]));
    assert_eq!(
        fs::read_to_string(fixture.root().join(CLIENT)).unwrap(),
        client
    );

    fixture.write(DOCUMENT, &SOURCE.replace("Fixture", "Stale"));
    failure(
        fixture.xtask(&["openapi", "--check"]),
        "docs/api/openapi.json:3:",
    );
    assert!(
        fs::read_to_string(fixture.root().join(DOCUMENT))
            .unwrap()
            .contains("Stale")
    );
    assert_eq!(
        fs::read_to_string(fixture.root().join(CLIENT)).unwrap(),
        client
    );

    fixture.write(DOCUMENT, SOURCE);
    fixture.write(
        CLIENT,
        &client.replace("Original description.", "Stale description."),
    );
    failure(
        fixture.xtask(&["openapi", "--check"]),
        "packages/app/src/api/generated/schema.ts:",
    );
    assert!(
        fs::read_to_string(fixture.root().join(CLIENT))
            .unwrap()
            .contains("Stale description.")
    );

    fixture.write(CLIENT, &client);
    fixture.write(
        "contract.json",
        &SOURCE.replace("Original description.", "Rust changed."),
    );
    let output = fixture.xtask(&["openapi", "--check"]);
    let diagnostics = String::from_utf8_lossy(&output.stderr);
    assert!(!output.status.success());
    assert!(
        diagnostics.contains("docs/api/openapi.json:5:"),
        "{diagnostics}"
    );
    assert!(
        diagnostics.contains("packages/app/src/api/generated/schema.ts:"),
        "{diagnostics}"
    );
    assert!(diagnostics.contains("Rust changed."), "{diagnostics}");
    assert_eq!(
        fs::read_to_string(fixture.root().join(DOCUMENT)).unwrap(),
        SOURCE
    );
    assert_eq!(
        fs::read_to_string(fixture.root().join(CLIENT)).unwrap(),
        client
    );
}

#[test]
fn a_large_document_uses_the_derived_stdin_without_pipe_deadlock() {
    let fixture = fixture();
    fixture.write(
        "contract.json",
        &SOURCE.replace(
            "Original description.",
            &"large description ".repeat(10_000),
        ),
    );
    success(fixture.xtask(&["openapi"]));
    success(fixture.xtask(&["openapi", "--check"]));
}

#[test]
fn a_failed_rust_generator_leaves_committed_outputs_unchanged() {
    let fixture = fixture();
    fixture.write(DOCUMENT, SOURCE);
    fixture.write(CLIENT, "original client\n");
    fixture.write(
        "src/main.rs",
        "fn main() { eprintln!(\"generation refused\"); std::process::exit(7); }\n",
    );
    failure(fixture.xtask(&["openapi"]), "generation refused");
    assert_eq!(
        fs::read_to_string(fixture.root().join(DOCUMENT)).unwrap(),
        SOURCE
    );
    assert_eq!(
        fs::read_to_string(fixture.root().join(CLIENT)).unwrap(),
        "original client\n"
    );
}

#[test]
fn help_names_generation_and_check_mode() {
    let factory: &dyn FixtureFactory = &TemporaryFixtures;
    let fixture = factory.create();
    assert!(success(fixture.xtask(&["--help"])).contains("openapi"));
    assert!(success(fixture.xtask(&["openapi", "--help"])).contains("--check"));
}
