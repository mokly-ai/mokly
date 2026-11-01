//! Completed extraction digests do not acquire a length on every open.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::tree::{Entry, Mode};
use mokly_model::material::digest;
use mokly_source_interface::tree::SourceTree;
use unimock::{MockFn, Unimock, matching};

use crate::git_tree::GitTree;
use crate::source_digest::SourceDigest;
use crate::sources::{SourcesMock, TreeIndex};

#[test]
fn prepared_extracted_asset_opens_twice_without_another_digest() {
    for ordinary_hash_first in [false, true] {
        let path = RepoPath::parse("image.svg").unwrap();
        let index = Arc::new(TreeIndex {
            entries: [(
                path.clone(),
                Entry {
                    path,
                    mode: Mode::File,
                    size: 6,
                    object: ObjectId::parse(&"a".repeat(40)).unwrap(),
                },
            )]
            .into(),
        });
        let calls = Arc::new(AtomicUsize::new(0));
        let recorded = calls.clone();
        let metadata = SourcesMock::index
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| Ok(index.clone())));
        let batch = SourcesMock::digest_with_length
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, paths| {
                assert_eq!(paths, &[RepoPath::parse("image.svg").unwrap()]);
                recorded.fetch_add(1, Ordering::SeqCst);
                Ok(vec![Ok(SourceDigest {
                    hash: digest(b"opaque"),
                    length: None,
                })])
            }));
        let bytes = SourcesMock::read_many
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(vec![b"opaque".to_vec()]))
            .n_times(2);
        let sources = if ordinary_hash_first {
            Unimock::new((
                metadata,
                batch,
                bytes,
                SourcesMock::digest
                    .some_call(matching!(_))
                    .returns(Ok(digest(b"opaque"))),
            ))
        } else {
            Unimock::new((metadata, batch, bytes))
        };
        let tree = GitTree::new("/repo".into(), Arc::new(sources), 4096);
        let path = Path::new("/repo/image.svg");
        if ordinary_hash_first {
            assert_eq!(tree.digest(path).unwrap(), digest(b"opaque"));
        }
        assert_eq!(tree.digest_unretained(path).unwrap(), digest(b"opaque"));
        assert_eq!(calls.load(Ordering::SeqCst), 1, "preparation");
        for _ in 0..2 {
            let mut stream = tree.open_stream(path).unwrap();
            assert_eq!(stream.length(), 6);
            let mut bytes = Vec::new();
            stream
                .copy_verified(path, &digest(b"opaque"), &mut bytes)
                .unwrap();
            assert_eq!(bytes, b"opaque");
        }
        assert_eq!(calls.load(Ordering::SeqCst), 1, "after both opens");
    }
}
