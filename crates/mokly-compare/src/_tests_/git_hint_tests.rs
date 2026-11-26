//! A projection hint answers many base projections with one batched lookup.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_git::error::Error as GitError;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::RepositoryMock;
use mokly_git::tree::{Entry, Limits, Mode};
use mokly_source_interface::tree::{FileKind, SourceTree};
use unimock::{MockFn, Unimock, matching};

use crate::git_tree::GitTree;
use crate::source_failures::SourceFailures;
use crate::sources::GitSources;

fn entry(path: &str, mode: Mode) -> Entry {
    Entry {
        path: RepoPath::parse(path).unwrap(),
        object: ObjectId::parse(&"b".repeat(40)).unwrap(),
        mode,
        size: 1,
    }
}

/// A base tree with the directory `styles` and the files `styles/{even}.css`. Each
/// lookup records its paths; a lookup of several paths fails when `batch_fails`.
fn tree(count: usize, batch_fails: bool) -> (GitTree, Arc<Mutex<Vec<Vec<String>>>>) {
    let mut known = vec![entry("styles", Mode::Directory)];
    known.extend(
        (0..count)
            .step_by(2)
            .map(|index| entry(&format!("styles/{index}.css"), Mode::File)),
    );
    let lookups = Arc::new(Mutex::new(Vec::new()));
    let recorded = lookups.clone();
    let repository = Unimock::new(
        RepositoryMock::lookup
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, paths, _| {
                recorded
                    .lock()
                    .unwrap()
                    .push(paths.iter().map(ToString::to_string).collect());
                if batch_fails && paths.len() > 1 {
                    return Err(GitError::FileCount { limit: 1 });
                }
                Ok(known
                    .iter()
                    .filter(|entry| paths.contains(&entry.path))
                    .cloned()
                    .collect())
            })),
    );
    let sources = GitSources::new(
        Arc::new(repository),
        ObjectId::parse(&"c".repeat(40)).unwrap(),
        Limits::default(),
    );
    (
        GitTree::new("/repo".into(), Arc::new(sources), 1024),
        lookups,
    )
}

fn file(index: usize) -> PathBuf {
    PathBuf::from(format!("/repo/styles/{index}.css"))
}

fn kinds(tree: &GitTree, count: usize) -> Vec<Option<FileKind>> {
    (0..count)
        .map(|index| tree.project(&file(index)).unwrap().map(|node| node.kind))
        .collect()
}

fn expected(count: usize) -> Vec<Option<FileKind>> {
    (0..count)
        .map(|index| (index % 2 == 0).then_some(FileKind::File))
        .collect()
}

/// The lookups of `count` hinted projections, half of them absent.
fn hinted(count: usize) -> usize {
    let (tree, lookups) = tree(count, false);
    tree.hint_projections(&(0..count).map(file).collect::<Vec<_>>());
    assert_eq!(kinds(&tree, count), expected(count));
    lookups.lock().unwrap().len()
}

#[test]
fn a_hint_answers_many_projections_with_one_lookup() {
    let (small, large) = (hinted(16), hinted(64));
    assert_eq!(small, 1);
    assert_eq!(large, small);
}

#[test]
fn a_hinted_directory_with_a_hinted_child_keeps_its_own_lookup() {
    let (tree, lookups) = tree(4, false);
    tree.hint_projections(&[PathBuf::from("/repo/styles"), file(0), file(2)]);
    let directory = tree.project(Path::new("/repo/styles")).unwrap().unwrap();
    assert_eq!(directory.kind, FileKind::Directory);
    assert_eq!(kinds(&tree, 4), expected(4));
    assert_eq!(
        *lookups.lock().unwrap(),
        [
            vec!["styles/0.css".to_owned(), "styles/2.css".to_owned()],
            vec!["styles".to_owned()],
            vec!["styles/1.css".to_owned()],
            vec!["styles/3.css".to_owned()],
        ]
    );
}

#[test]
fn a_failed_hint_leaves_each_projection_its_own_lookup() {
    let (tree, lookups) = tree(4, true);
    tree.hint_projections(&(0..4).map(file).collect::<Vec<_>>());
    assert_eq!(kinds(&tree, 4), expected(4));
    assert!(tree.failure().is_none());
    assert_eq!(lookups.lock().unwrap().len(), 5);
}
