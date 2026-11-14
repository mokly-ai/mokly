//! A failed per-asset digest bound is retained for the base preparation.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_git::error;
use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::tree::{Entry, Mode};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::SourceTree;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::git_tree::GitTree;
use crate::sources::{SourcesMock, TreeIndex};

#[test]
fn a_failed_asset_bound_is_converted_only_once() {
    let relative = RepoPath::parse("image.svg").unwrap();
    let index = Arc::new(TreeIndex {
        entries: [(
            relative.clone(),
            Entry {
                path: relative,
                mode: Mode::File,
                size: 64 * 1024 * 1024 + 1,
                object: ObjectId::parse(&"a".repeat(40)).unwrap(),
            },
        )]
        .into(),
    });
    let calls = Arc::new(AtomicUsize::new(0));
    let recorded = calls.clone();
    let sources = Unimock::new((
        SourcesMock::index
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| Ok(index.clone()))),
        SourcesMock::digest_with_length
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, paths| {
                assert_eq!(paths, &[RepoPath::parse("image.svg").unwrap()]);
                recorded.fetch_add(1, Ordering::SeqCst);
                Ok(vec![Err(Error::Git {
                    source: error::Error::Conversion {
                        path: "image.svg".into(),
                        source: Box::new(error::Error::ByteLimit {
                            limit: 64 * 1024 * 1024,
                        }),
                    },
                })])
            })),
    ));
    let tree = GitTree::new("/repo".into(), Arc::new(sources), 4096);
    let path = Path::new("/repo/image.svg");
    for _ in 0..3 {
        let result = tree.digest_unretained(path);
        assert!(
            matches!(result, Err(SourceError::Unavailable { path: failed, message })
            if failed == path && message.ends_with("source bytes exceed 67108864 bytes"))
        );
    }
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(matches!(
        tree.digest(path),
        Err(SourceError::Unavailable { .. })
    ));
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
