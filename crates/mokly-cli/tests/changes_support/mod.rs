//! Real Git fixtures for build Changes acceptance tests.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use tempfile::TempDir;

pub fn write(root: &Path, path: &str, body: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, body).unwrap();
}

pub fn git(root: &Path, arguments: &[&str]) {
    let output = Command::new("git")
        .current_dir(root)
        .args(arguments)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

pub fn run(root: &Path, arguments: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .current_dir(root)
        .args(arguments)
        .env("MOKLY_OUTPUT", "rich")
        .env(
            "MOKLY_PACKAGE_ROOT",
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
        )
        .env_remove("CI")
        .output()
        .unwrap()
}

pub fn base(files: &[(&str, &str)]) -> TempDir {
    let directory = TempDir::new().unwrap();
    write(
        directory.path(),
        "mokly.config.json",
        "{\"review\":{\"base\":\"fixture-base\"}}",
    );
    for (path, body) in files {
        write(directory.path(), path, body);
    }
    git(directory.path(), &["init", "--initial-branch=fixture-base"]);
    git(directory.path(), &["add", "."]);
    git(
        directory.path(),
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "-m",
            "fixture base",
        ],
    );
    directory
}
