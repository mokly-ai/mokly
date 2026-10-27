//! The fingerprint algorithm over a mocked Git and file-system boundary.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use unimock::{Clause, MockFn, Unimock, matching};

use crate::source_tree::error::Error;
use crate::source_tree::records::{Mode, Record, fingerprint_records};
use crate::source_tree::system::{
    Entry, TreeEntryMock, TreeIndexMock, TreeReadFileMock, TreeReadLinkMock, TreeUntrackedMock,
};

use super::read_source_tree;

const ROOT: &str = "/repository";

/// The `git ls-files --stage -z` entries of regular files.
fn staged(paths: &[&str]) -> Vec<u8> {
    paths
        .iter()
        .flat_map(|path| format!("100644 {} 0\t{path}\0", "a".repeat(40)).into_bytes())
        .collect()
}

fn at(path: &str) -> PathBuf {
    Path::new(ROOT).join(path)
}

/// The bytes that the mocked file reads return for `path`.
fn content(path: &str) -> Vec<u8> {
    at(path).to_string_lossy().into_owned().into_bytes()
}

/// Fixed Git listings.
fn listings(index: Vec<u8>, untracked: &'static str) -> impl Clause {
    (
        TreeIndexMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(index.clone()))),
        TreeUntrackedMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(untracked.as_bytes().to_vec()))),
    )
}

/// Listed paths with the given types. Every other path is missing.
fn entries(entries: Vec<(&'static str, Entry)>) -> impl Clause {
    TreeEntryMock
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, path| {
            Ok(entries
                .iter()
                .find(|(name, _)| at(name) == path)
                .map(|(_, entry)| *entry))
        }))
}

/// File reads that return the path text.
fn files() -> impl Clause {
    TreeReadFileMock
        .each_call(matching!(_))
        .answers(&|_, path| Ok(path.to_string_lossy().into_owned().into_bytes()))
}

/// Link reads that return the same target.
fn links() -> impl Clause {
    TreeReadLinkMock
        .each_call(matching!(_))
        .answers(&|_, _| Ok(b"target".to_vec()))
}

fn unsupported(path: &str) -> String {
    format!(
        "[xtask/source-tree] source-tree fingerprint found an unsupported file type at \"{path}\"; ignore or remove a nested repository or worktree"
    )
}

#[test]
fn submodule_index_entries_fail_before_any_other_read() {
    let mut index = format!("160000 {} 0\tmodule\0", "b".repeat(40)).into_bytes();
    index.extend(staged(&["file.txt"]));
    let system = Unimock::new(
        TreeIndexMock
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(index.clone()))),
    );
    let error = read_source_tree(&system, Path::new(ROOT)).unwrap_err();
    assert!(matches!(error, Error::Submodule));
    assert_eq!(
        error.to_string(),
        "[xtask/source-tree] source-tree fingerprint does not support submodule entries"
    );
}

#[test]
fn files_executables_links_and_untracked_files_become_records() {
    let system = Unimock::new((
        listings(staged(&["a", "b", "link"]), "u\0a\0"),
        entries(vec![
            ("a", Entry::File { executable: false }),
            ("b", Entry::File { executable: true }),
            ("link", Entry::Symlink),
            ("u", Entry::File { executable: false }),
        ]),
        files(),
        links(),
    ));
    let expected = fingerprint_records(&[
        Record::new(Mode::Regular, b"a".to_vec(), &content("a")),
        Record::new(Mode::Executable, b"b".to_vec(), &content("b")),
        Record::new(Mode::Symlink, b"link".to_vec(), b"target"),
        Record::new(Mode::Regular, b"u".to_vec(), &content("u")),
    ]);
    assert_eq!(
        read_source_tree(&system, Path::new(ROOT)).unwrap(),
        expected
    );
}

#[test]
fn missing_paths_and_paths_below_links_or_files_count_as_deletions() {
    let checks = Arc::new(AtomicUsize::new(0));
    let counted = Arc::clone(&checks);
    let types = [
        ("linked", Entry::Symlink),
        ("file", Entry::File { executable: false }),
        ("dir", Entry::Directory),
        ("dir/kept", Entry::File { executable: false }),
        ("dir/also", Entry::File { executable: false }),
    ];
    let system = Unimock::new((
        listings(
            staged(&["gone", "linked/inner", "file/inner", "dir/kept", "dir/also"]),
            "",
        ),
        TreeEntryMock
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                if path == at("dir") {
                    counted.fetch_add(1, Ordering::SeqCst);
                }
                Ok(types
                    .iter()
                    .find(|(name, _)| at(name) == path)
                    .map(|(_, entry)| *entry))
            })),
        files(),
    ));
    let expected = fingerprint_records(&[
        Record::new(Mode::Regular, b"dir/also".to_vec(), &content("dir/also")),
        Record::new(Mode::Regular, b"dir/kept".to_vec(), &content("dir/kept")),
    ]);
    assert_eq!(
        read_source_tree(&system, Path::new(ROOT)).unwrap(),
        expected
    );
    assert_eq!(checks.load(Ordering::SeqCst), 1, "one check per directory");
}

#[test]
fn an_index_directory_without_git_metadata_counts_as_a_deletion() {
    let system = Unimock::new((
        listings(staged(&["a"]), ""),
        entries(vec![("a", Entry::Directory)]),
    ));
    assert_eq!(
        read_source_tree(&system, Path::new(ROOT)).unwrap(),
        fingerprint_records(&[])
    );
}

#[test]
fn a_nested_repository_at_an_index_path_fails_with_its_quoted_path() {
    let system = Unimock::new((
        listings(staged(&["a"]), ""),
        entries(vec![
            ("a", Entry::Directory),
            ("a/.git", Entry::File { executable: false }),
        ]),
    ));
    let error = read_source_tree(&system, Path::new(ROOT)).unwrap_err();
    assert!(matches!(error, Error::UnsupportedType { .. }));
    assert_eq!(error.to_string(), unsupported("a"));
}

#[test]
fn untracked_directories_and_other_file_types_fail() {
    let nested = Unimock::new((
        listings(Vec::new(), "nested/worker/\0"),
        entries(vec![
            ("nested", Entry::Directory),
            ("nested/worker", Entry::Directory),
        ]),
    ));
    let error = read_source_tree(&nested, Path::new(ROOT)).unwrap_err();
    assert_eq!(error.to_string(), unsupported("nested/worker/"));

    let fifo = Unimock::new((
        listings(staged(&["pipe"]), ""),
        entries(vec![("pipe", Entry::Other)]),
    ));
    let error = read_source_tree(&fifo, Path::new(ROOT)).unwrap_err();
    assert_eq!(error.to_string(), unsupported("pipe"));
}
