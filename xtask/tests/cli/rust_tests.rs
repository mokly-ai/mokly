//! Real Cargo rejection fixtures complement merged-suite dispatch tests.

use super::support::{Fixture, FixtureFactory, TemporaryFixtures, failure, success};

fn prepare(fixture: &dyn Fixture) {
    fixture.write(
        "Cargo.toml",
        "[package]\nname = 'mokly-fixture'\nversion = '0.1.0'\nedition = '2024'\n",
    );
    fixture.write("src/lib.rs", "//! Fixture crate.\n");
    success(fixture.run("cargo", &["generate-lockfile", "--offline"]));
}

#[test]
fn rust_format_stage_rejects_unformatted_source() {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    success(fixture.run("cargo", &["fmt", "--all", "--", "--check"]));
    fixture.write("src/lib.rs", "pub fn add(x:i32)->i32{x+1}\n");
    failure(
        fixture.run("cargo", &["fmt", "--all", "--", "--check"]),
        "Diff in",
    );
}

#[test]
fn clippy_stage_rejects_a_real_warning() {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    let args = [
        "clippy",
        "--locked",
        "-p",
        "mokly-*",
        "--all-targets",
        "--",
        "-D",
        "warnings",
    ];
    success(fixture.run("cargo", &args));
    fixture.write("src/lib.rs", "pub fn unused() { let unused_value = 1; }\n");
    failure(fixture.run("cargo", &args), "unused variable");
}

#[test]
fn test_stage_rejects_a_failing_rust_test() {
    let fixture = TemporaryFixtures.create();
    prepare(fixture.as_ref());
    let tests = [
        "nextest",
        "run",
        "--locked",
        "-p",
        "mokly-*",
        "--no-tests=pass",
    ];
    let docs = ["test", "--locked", "-p", "mokly-*", "--doc"];
    success(fixture.run("cargo", &tests));
    success(fixture.run("cargo", &docs));
    fixture.write(
        "tests/failure.rs",
        "#[test]\nfn rejected() { assert_eq!(1, 2); }\n",
    );
    failure(fixture.run("cargo", &tests), "1 failed");
    fixture.write(
        "src/lib.rs",
        "//! Fixture crate.\n//!\n//! ```\n//! assert_eq!(1, 2);\n//! ```\n",
    );
    failure(fixture.run("cargo", &docs), "test result: FAILED");
}
