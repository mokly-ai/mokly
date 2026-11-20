//! Real Git-visible files and the stricter all-file Rust length contract.

use std::fs;
#[cfg(unix)]
use std::os::unix::fs::symlink;

use super::support::{FixtureFactory, TemporaryFixtures, failure, success};

fn lines(count: usize) -> String {
    (1..=count)
        .map(|number| format!("//! Line {number}\n"))
        .collect()
}

#[test]
fn untracked_rust_is_checked_and_all_audits_unchanged_main_files() {
    let fixture = TemporaryFixtures.create();
    fixture.write("crates/old.rs", &lines(301));
    fixture.baseline();
    failure(
        fixture.xtask(&["rust-file-length-lint"]),
        "old.rs: 301 lines",
    );
    failure(
        fixture.xtask(&["rust-file-length-lint", "--all"]),
        "old.rs: 301 lines",
    );
    fixture.write("crates/old.rs", "//! Valid\n");
    fixture.write("xtask/new.rs", &lines(301));
    failure(
        fixture.xtask(&["rust-file-length-lint"]),
        "new.rs: 301 lines",
    );
    fixture.write("xtask/new.rs", "//! Valid\n");
    fixture.write("crates/old.rs", &lines(302));
    failure(
        fixture.xtask(&["rust-file-length-lint"]),
        "old.rs: 302 lines",
    );
    fs::remove_file(fixture.root().join("crates/old.rs")).unwrap();
    success(fixture.xtask(&["rust-file-length-lint"]));
}

#[test]
fn changed_rust_file_types_are_checked() {
    let fixture = TemporaryFixtures.create();
    fixture.write("source.txt", &lines(301));
    fixture.write("crates/README.md", "# Fixture\n");
    #[cfg(unix)]
    symlink("../source.txt", fixture.root().join("crates/linked.rs")).unwrap();
    #[cfg(windows)]
    fixture.write("crates/linked.rs/source.rs", &lines(301));
    fixture.baseline();
    failure(fixture.xtask(&["rust-file-length-lint"]), "301 lines");
    #[cfg(unix)]
    fs::remove_file(fixture.root().join("crates/linked.rs")).unwrap();
    #[cfg(windows)]
    fs::remove_dir_all(fixture.root().join("crates/linked.rs")).unwrap();
    fixture.write("crates/linked.rs", &lines(301));
    failure(
        fixture.xtask(&["rust-file-length-lint"]),
        "linked.rs: 301 lines",
    );
}

#[test]
fn whitespace_finds_untracked_files_but_obeys_gitignore() {
    let fixture = TemporaryFixtures.create();
    fixture.write("target/ignored.txt", " ");
    success(fixture.xtask(&["whitespace"]));
    fixture.write("new file.txt", "bad \n");
    failure(fixture.xtask(&["whitespace"]), "trailing whitespace");
    fixture.write("new file.txt", "bad");
    failure(fixture.xtask(&["whitespace"]), "missing final newline");
}

#[test]
fn migration_history_cannot_be_rewritten_even_with_matching_new_lock() {
    let fixture = TemporaryFixtures.create();
    let directory = "crates/mkc-db/migrations/202609141200_create";
    let path = "crates/mkc-db/migration-lock.txt";
    fixture.write(path, "");
    success(fixture.xtask(&["migration-immutability"]));
    for name in ["down.sql", "up.sql"] {
        fixture.write(&format!("{directory}/{name}"), "");
    }
    fixture.write(path, &format!("# Lock\nfnv1a64:cbf29ce484222325 {directory}/down.sql\nfnv1a64:cbf29ce484222325 {directory}/up.sql\n"));
    fixture.baseline();
    success(fixture.xtask(&["migration-immutability"]));
    fixture.write(&format!("{directory}/up.sql"), "hello");
    fixture.write(path, &format!("# Lock\nfnv1a64:cbf29ce484222325 {directory}/down.sql\nfnv1a64:a430d84680aabd0b {directory}/up.sql\n"));
    failure(fixture.xtask(&["migration-immutability"]), "origin/main");
    success(fixture.run("git", &["update-ref", "-d", "refs/remotes/origin/main"]));
    failure(fixture.xtask(&["migration-immutability"]), "origin/main");
}

#[test]
fn cli_lists_stages_and_rejects_unknown_options() {
    let fixture = TemporaryFixtures.create();
    let help = success(fixture.xtask(&["--help"]));
    for command in [
        "check",
        "mokly-fixtures",
        "email-templates",
        "stripe-catalogue",
        "openapi",
        "migration-immutability",
        "rust-file-length-lint",
    ] {
        assert!(help.contains(command), "{command}: {help}");
    }
    let help = success(fixture.xtask(&["check", "--help"]));
    for suite in [
        "repository",
        "viewer",
        "browser",
        "native",
        "cloud-rust",
        "cloud-app",
        "cloud-desktop",
        "cloud-infrastructure",
    ] {
        assert!(help.contains(suite), "{suite}: {help}");
    }
    failure(
        fixture.run(env!("CARGO_BIN_EXE_xtask"), &["not-a-command"]),
        "unrecognized subcommand",
    );
    failure(
        fixture.run(env!("CARGO_BIN_EXE_xtask"), &["check", "--unknown"]),
        "unexpected argument",
    );
}
