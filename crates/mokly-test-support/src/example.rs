//! A copy of the repository's example catalogue that a test can build or change.

use std::fs;

use tempfile::TempDir;

use crate::files::{link_directory, write};
use crate::git::git;
use crate::workspace;

/// The paths that the example reads: its sources, and the documents that its entries link.
const SOURCES: [&str; 4] = [
    ".gitignore",
    "examples",
    "docs/protocol",
    "plans/rust-rebuild.md",
];

/// Copy the example's tracked and unignored files, with the workspace `node_modules`, into
/// a new directory. The copy's root is the example's `repoRoot`, so a build can write below it.
pub fn copy() -> TempDir {
    let directory = TempDir::new().unwrap();
    let root = workspace::root();
    let mut args = vec![
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
    ];
    args.extend(SOURCES);
    let listed = git(&root, &args);
    for name in listed.split('\0').filter(|name| !name.is_empty()) {
        let source = root.join(name);
        // A tracked file that the working tree deleted is no part of the example.
        if source.is_file() {
            let target = directory.path().join(name);
            fs::create_dir_all(target.parent().unwrap()).unwrap();
            fs::copy(source, target).unwrap();
        }
    }
    write(
        directory.path(),
        "package.json",
        r#"{"private":true,"type":"module"}"#,
    );
    link_directory(
        &root.join("node_modules"),
        &directory.path().join("node_modules"),
    );
    directory
}
