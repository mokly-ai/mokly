//! One commit tree query supplies exact identities and batched blob reads.

use std::sync::Arc;

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::RepositoryMock;
use mokly_git::tree::{Entry, Limits, Mode};
use unimock::{MockFn, Unimock, matching};

use crate::error::{Error, GitResult};
use crate::sources::{GitSources, Sources};

#[test]
fn source_index_expands_only_requested_roots_and_reuses_metadata() {
    let commit = ObjectId::parse(&"a".repeat(40)).unwrap();
    let entry = Entry {
        path: RepoPath::parse("specs/A.html").unwrap(),
        object: commit.clone(),
        mode: Mode::File,
        size: 1,
    };
    let link = Entry {
        path: RepoPath::parse("specs/link").unwrap(),
        mode: Mode::Symlink,
        ..entry.clone()
    };
    let directory = Entry {
        path: RepoPath::parse("specs").unwrap(),
        mode: Mode::Directory,
        ..entry.clone()
    };
    let repository = Unimock::new((
        RepositoryMock::list.next_call(matching!((_, Some(root), limits) if root.as_str() == "specs" && limits.files == 2 && limits.nodes == 8)).returns(Ok(vec![link, directory, entry.clone()])),
        RepositoryMock::read_many.next_call(matching!((entries, limits) if entries.len() == 1 && entries[0].path.as_str() == "specs/A.html" && limits.blob == 1)).returns(Ok(vec![vec![255]])),
    ));
    let reader = GitSources::new(
        Arc::new(repository),
        commit,
        Limits {
            files: 2,
            nodes: 8,
            ..Limits::default()
        },
    );
    let sources: &dyn Sources = &reader;
    assert!(sources.list(&[], Limits::default()).unwrap().is_empty());
    assert_eq!(
        sources
            .list(
                &[Some(RepoPath::parse("specs").unwrap())],
                Limits::default()
            )
            .unwrap(),
        std::slice::from_ref(&entry)
    );
    assert_eq!(sources.index().unwrap().entries.len(), 3);
    assert_eq!(
        sources
            .list(
                &[Some(RepoPath::parse("specs").unwrap())],
                Limits::default()
            )
            .unwrap(),
        std::slice::from_ref(&entry)
    );
    assert_eq!(sources.read(&entry.path, 1).unwrap(), [255]);
}

#[test]
fn an_extraction_blob_limit_retains_its_exact_path_at_the_comparison_boundary() {
    let result: mokly_git::error::Result<()> = Err(mokly_git::error::Error::BlobLimit {
        path: "movie.mp4".into(),
        limit: 64,
    });
    assert!(
        matches!(result.at_path("."), Err(Error::Limit { path, source: mokly_git::error::Error::ByteLimit { limit: 64 } }) if path == "movie.mp4")
    );
}
