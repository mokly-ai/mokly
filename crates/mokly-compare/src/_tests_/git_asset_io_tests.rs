//! Opaque Git hashing and delivery leave the private source-byte cache empty.

use std::io;
use std::path::Path;
use std::sync::Arc;

use mokly_git::identity::{ObjectId, RepoPath};
use mokly_git::tree::{Entry, Mode};
use mokly_model::material::digest;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::SourceTree;
use unimock::{MockFn, Unimock, matching};

use crate::git_tree::GitTree;
use crate::sources::{SourcesMock, TreeIndex};

#[test]
fn opaque_hashes_memoize_without_blobs_and_streams_do_not_fill_the_byte_lru() {
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
    let sources = Unimock::new((
        SourcesMock::index
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| Ok(index.clone()))),
        SourcesMock::digest
            .next_call(matching!((path) if path.as_str() == "image.svg"))
            .returns(Ok(digest(b"opaque"))),
        SourcesMock::read_many
            .each_call(
                matching!((paths, _) if paths.len() == 1 && paths[0].as_str() == "image.svg"),
            )
            .answers(&|_, _, _| Ok(vec![b"opaque".to_vec()]))
            .n_times(2),
    ));
    let tree: &dyn SourceTree = &GitTree::new("/repo".into(), Arc::new(sources), 4096);
    let path = Path::new("/repo/image.svg");
    assert_eq!(tree.digest_unretained(path).unwrap(), digest(b"opaque"));
    assert_eq!(tree.digest_unretained(path).unwrap(), digest(b"opaque"));
    let mut stream = tree.open_stream(path).unwrap();
    let mut output = Vec::new();
    stream
        .copy_verified(path, &digest(b"opaque"), &mut output)
        .unwrap();
    assert_eq!(output, b"opaque");
    assert_eq!(tree.read(path).unwrap(), b"opaque");
}

#[test]
fn git_source_errors_keep_the_failed_operation() {
    let tree: &dyn SourceTree = &GitTree::new("/repo".into(), Arc::new(Unimock::new(())), 4096);
    let root = Path::new("/repo");
    for error in [
        tree.digest(root).unwrap_err(),
        tree.digest_unretained(root).unwrap_err(),
    ] {
        assert!(
            matches!(error, SourceError::Io { operation: "digest", path, source }
            if path == root && source.kind() == io::ErrorKind::IsADirectory)
        );
    }
    assert!(matches!(tree.open_stream(root).err().unwrap(),
        SourceError::Io { operation: "open stream", path, source }
            if path == root && source.kind() == io::ErrorKind::IsADirectory));
}
