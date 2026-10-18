//! Fixture preparation and sequential scenarios use current sources, never project history.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;

use crate::changes_support::{git, write};

mod callers;
mod delivery;
mod matrix;
mod native;
mod scopes;
mod shared;

pub fn fixture() -> TempDir {
    let directory = TempDir::new().unwrap();
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let files = Command::new("git")
        .args([
            "ls-files",
            "-z",
            "--",
            "examples",
            "docs/protocol",
            "plans/rust-rebuild.md",
        ])
        .current_dir(&workspace)
        .output()
        .unwrap();
    assert!(files.status.success());
    for name in files
        .stdout
        .split(|byte| *byte == 0)
        .filter(|name| !name.is_empty())
    {
        let name = std::str::from_utf8(name).unwrap();
        let target = directory.path().join(name);
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::copy(workspace.join(name), target).unwrap();
    }
    write(
        directory.path(),
        "package.json",
        r#"{"name":"design-attribution-fixture","private":true,"type":"module"}"#,
    );
    write(directory.path(), ".gitignore", "node_modules/\n.context/\n");
    write(directory.path(), matrix::SCREEN_FILE, matrix::SCREEN);
    callers::seed(directory.path());
    delivery::seed(directory.path());
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        workspace.join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(
        workspace.join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    git(directory.path(), &["init", "--initial-branch=fixture-base"]);
    commit(directory.path(), "registered design base");
    git(directory.path(), &["switch", "-c", "fixture-head"]);
    directory
}

fn commit(root: &Path, label: &str) {
    git(root, &["add", "."]);
    git(
        root,
        &[
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit",
            "--allow-empty",
            "-m",
            label,
        ],
    );
}

pub fn run(root: &Path) {
    {
        let session = native::Session::new(root);
        commit(root, "unchanged registered design head");
        let baseline = session.compare(root);
        assert!(baseline.snapshot.changed_entries.is_empty());
        assert!(baseline.review.affected.is_empty());
        let expected = scopes::check(&baseline);
        scopes::own_props(&baseline);
        matrix::temporary(&baseline);
        shared::run(root, &session, &expected);
        delivery::run(root, &session);
        matrix::run(root, &session, &baseline);
    }
}

fn edit(
    root: &Path,
    session: &native::Session,
    label: &str,
    edits: &[(&str, String)],
    check: &dyn Fn(&mokly_compare::comparison_types::ComparisonResult),
) {
    let originals: Vec<_> = edits
        .iter()
        .map(|(path, _)| fs::read(root.join(path)).ok())
        .collect();
    for (path, text) in edits {
        write(root, path, text);
    }
    commit(root, label);
    println!("Design attribution scenario: {label}");
    let result = session.compare(root);
    scopes::check(&result);
    check(&result);
    for ((path, _), original) in edits.iter().zip(originals) {
        match original {
            Some(bytes) => fs::write(root.join(path), bytes).unwrap(),
            None => fs::remove_file(root.join(path)).unwrap(),
        }
    }
}

fn text(root: &Path, path: &str) -> String {
    fs::read_to_string(root.join(path)).unwrap()
}
