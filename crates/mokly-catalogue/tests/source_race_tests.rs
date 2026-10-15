//! A leaf replaced by a symlink after listing must not become an entry source.

#![cfg(unix)]

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::{Discoverer, Discovery};
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use tempfile::TempDir;
use unimock::{MockFn, Unimock, matching};

#[cfg(unix)]
#[test]
fn a_matched_regular_file_replaced_by_a_symlink_is_dropped() {
    let directory = TempDir::new().unwrap();
    fs::create_dir(directory.path().join("specs")).unwrap();
    fs::write(directory.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(directory.path().join("specs/home.md"), "# Home").unwrap();
    let actual = Arc::new(WorkingTree);
    let config = Loader {
        tree: actual.clone(),
    }
    .load(directory.path(), Some("mokly.config.json"))
    .unwrap();
    let listing = actual.clone();
    let projection = actual;
    let mock = Arc::new(Unimock::new((
        SourceTreeMock::children
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                let children = listing.children(path)?;
                fs::rename(path.join("home.md"), path.join("target.txt")).unwrap();
                std::os::unix::fs::symlink("target.txt", path.join("home.md")).unwrap();
                Ok(children)
            })),
        SourceTreeMock::project
            .next_call(
                matching!((path) if path.file_name()==Some(Path::new("home.md").as_os_str())),
            )
            .answers_arc(Arc::new(move |_, path| projection.project(path))),
    )));
    let discovery: &dyn Discovery = &Discoverer { tree: mock };
    let CatalogueError::Config(issue) = discovery.discover(&config, None).unwrap_err() else {
        panic!()
    };
    assert_eq!(
        issue.message,
        "root matches no file: specs; not searched: specs/home.md"
    );
}

#[test]
fn directory_reads_do_not_follow_a_replacement_symlink() {
    let directory = TempDir::new().unwrap();
    let original = directory.path().join("subdir");
    let target = directory.path().join("target");
    fs::create_dir(&original).unwrap();
    fs::write(original.join("home.md"), "# Home").unwrap();
    fs::rename(&original, &target).unwrap();
    std::os::unix::fs::symlink(&target, &original).unwrap();
    let error = WorkingTree.children(&original).unwrap_err();
    assert_eq!(error.code(), "ENOTDIR");
}
