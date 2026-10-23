//! The Git adapter projects every mode and batches sequential source reads.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::tree::{Entry, Mode};
use mokly_source_interface::tree::{FileKind, SourceTree};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::git_tree::GitTree;
use crate::source_failures::SourceFailures;
use crate::sources::{SourcesMock, TreeIndex};

#[test]
fn projections_children_and_reads_share_an_index_and_one_blob_batch() {
    let mut entries = BTreeMap::new();
    for (name, mode) in [
        ("specs", Mode::Directory),
        ("specs/a", Mode::File),
        ("specs/b", Mode::Executable),
        ("link", Mode::Symlink),
        ("submodule", Mode::Submodule),
    ] {
        let path = RepoPath::parse(name).unwrap();
        entries.insert(
            path.clone(),
            Entry {
                path,
                mode,
                size: 1,
                object: ObjectId::parse(&"a".repeat(40)).unwrap(),
            },
        );
    }
    let index = Arc::new(TreeIndex { entries });
    let sources = Unimock::new((
        SourcesMock::index
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| Ok(index.clone()))),
        SourcesMock::read_many
            .next_call(matching!((paths, _) if paths.len() == 2 && paths[0].as_str() == "specs/a"))
            .returns(Ok(vec![vec![1], vec![2]])),
    ));
    let tree: &dyn SourceTree = &GitTree::new(PathBuf::from("/repo"), Arc::new(sources), 4096);
    assert_eq!(
        tree.project(Path::new("/repo")).unwrap().unwrap().kind,
        FileKind::Directory
    );
    assert_eq!(tree.children(Path::new("/repo/specs")).unwrap().len(), 2);
    assert_eq!(tree.children(Path::new("/repo")).unwrap().len(), 3);
    assert_eq!(
        tree.project(Path::new("/repo/link")).unwrap().unwrap().kind,
        FileKind::Symlink
    );
    assert_eq!(
        tree.project(Path::new("/repo/submodule"))
            .unwrap()
            .unwrap()
            .kind,
        FileKind::Other
    );
    assert!(tree.project(Path::new("/repo/missing")).unwrap().is_none());
    tree.prefetch(&[
        PathBuf::from("/repo/specs/a"),
        PathBuf::from("/repo/specs/b"),
    ])
    .unwrap();
    assert_eq!(tree.read(Path::new("/repo/specs/a")).unwrap(), [1]);
    assert_eq!(tree.read(Path::new("/repo/specs/b")).unwrap(), [2]);
    assert!(tree.read(Path::new("/repo/link")).is_err());
    assert!(tree.children(Path::new("/repo/specs/a")).is_err());
    assert!(
        tree.read(Path::new("/repo/missing"))
            .unwrap_err()
            .is_vanished()
    );
    assert!(tree.project(Path::new("/repo/../other")).is_err());
    assert!(tree.project(Path::new("/other")).is_err());
}

#[test]
fn a_genuine_git_failure_cannot_be_hidden_by_an_earlier_source_limit() {
    let tree = GitTree::new("/repo".into(), Arc::new(Unimock::new(())), 4096);
    let path = Path::new("/repo/movie.mp4");
    let limit = || Error::Limit {
        path: "movie.mp4".into(),
        source: mokly_git::error::Error::ByteLimit { limit: 64 },
    };
    let _ = tree.failed("read", path, limit());
    let _ = tree.failed(
        "read",
        path,
        Error::Git {
            source: mokly_git::error::Error::CommandFailed {
                status: Some(128),
                stderr: b"missing object".to_vec(),
            },
        },
    );
    let _ = tree.failed("read", path, limit());
    assert!(matches!(
        tree.failure().as_deref(),
        Some(Error::Git {
            source: mokly_git::error::Error::CommandFailed {
                status: Some(128),
                ..
            }
        })
    ));
}
