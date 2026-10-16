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
    run_with_node(root, arguments, None)
}

/// Run the CLI with a temporary cache and an optional Node executable.
pub fn run_with_node(root: &Path, arguments: &[&str], node: Option<&Path>) -> Output {
    run_with_timeout(root, arguments, node, None)
}

pub fn run_with_timeout(
    root: &Path,
    arguments: &[&str],
    node: Option<&Path>,
    timeout: Option<&str>,
) -> Output {
    let cache = TempDir::new().unwrap();
    let cache_root = cache.path().canonicalize().unwrap();
    let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
    command
        .current_dir(root)
        .args(arguments)
        .env("MOKLY_OUTPUT", "rich")
        .env("XDG_CACHE_HOME", &cache_root)
        .env("HOME", &cache_root)
        .env("LOCALAPPDATA", &cache_root)
        .env("TMPDIR", &cache_root)
        .env("TMP", &cache_root)
        .env("TEMP", &cache_root)
        .env(
            "MOKLY_PACKAGE_ROOT",
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
        )
        .env_remove("CI");
    if let Some(node) = node {
        command.env("MOKLY_NODE_EXECUTABLE", node);
    }
    if let Some(timeout) = timeout {
        command.env("MOKLY_SIDECAR_TIMEOUT_MS", timeout);
    }
    let output = command.output().unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines().filter(|line| line.starts_with("  cache ")) {
        let prefix = format!("  cache {}", cache_root.display());
        let visible = line.trim_end_matches('…');
        assert!(
            visible.starts_with(&prefix) || prefix.starts_with(visible),
            "{line}"
        );
        assert!(
            cache_root.read_dir().unwrap().next().is_some(),
            "cache must be inside the temporary root"
        );
    }
    output
}

pub fn base(files: &[(&str, &str)]) -> TempDir {
    let directory = TempDir::new().unwrap();
    write(
        directory.path(),
        ".gitignore",
        "node_modules/\nmokly-static/\n.context/\n",
    );
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
