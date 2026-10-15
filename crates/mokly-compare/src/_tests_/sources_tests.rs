//! Source identity, regular-file selection and bounded reads through Git mocks.

use std::sync::Arc;

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::repository::RepositoryMock;
use mokly_git::tree::{Entry, Limits, Mode};
use unimock::{MockFn, Unimock, matching};

use crate::sources::{GitSources, Sources};

#[test]
fn source_roots_preserve_spelling_deduplicate_and_skip_links() {
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
    let sources: &dyn Sources = &GitSources {
        commit,
        repository: Arc::new(Unimock::new((
            RepositoryMock::list
                .next_call(matching!((_, Some(root), _ ) if root.as_str() == "specs"))
                .returns(Ok(vec![link, entry.clone()])),
            RepositoryMock::list
                .next_call(matching!(_, None, _))
                .returns(Ok(vec![entry.clone()])),
            RepositoryMock::read
                .next_call(matching!((_, path, 1) if path.as_str() == "specs/A.html"))
                .returns(Ok(vec![255])),
        ))),
    };
    assert!(sources.list(&[], Limits::default()).unwrap().is_empty());
    assert_eq!(
        sources
            .list(
                &[Some(RepoPath::parse("specs").unwrap()), None],
                Limits::default()
            )
            .unwrap(),
        vec![entry.clone()]
    );
    assert_eq!(sources.read(&entry.path, 1).unwrap(), vec![255]);
}
