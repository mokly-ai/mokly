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
use crate::source_digest::SourceDigest;
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
        SourcesMock::digest_with_length
            .next_call(matching!((paths) if paths.len() == 1 && paths[0].as_str() == "image.svg"))
            .returns(Ok(vec![Ok(SourceDigest {
                hash: digest(b"opaque"),
                length: Some(6),
            })])),
        SourcesMock::stream
            .next_call(matching!((path, _, _) if path.as_str() == "image.svg"))
            .answers(&|_, _, output, _| {
                output.write_all(b"opaque").unwrap();
                Ok(6)
            }),
        SourcesMock::read_many
            .each_call(
                matching!((paths, _) if paths.len() == 1 && paths[0].as_str() == "image.svg"),
            )
            .answers(&|_, _, _| Ok(vec![b"opaque".to_vec()]))
            .n_times(1),
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

#[test]
fn a_nonregular_git_entry_is_a_changed_input_before_blob_delivery() {
    let path = RepoPath::parse("image.svg").unwrap();
    let index = Arc::new(TreeIndex {
        entries: [(
            path.clone(),
            Entry {
                path,
                mode: Mode::Symlink,
                size: 6,
                object: ObjectId::parse(&"a".repeat(40)).unwrap(),
            },
        )]
        .into(),
    });
    let sources = Unimock::new(
        SourcesMock::index
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| Ok(index.clone()))),
    );
    let tree: &dyn SourceTree = &GitTree::new("/repo".into(), Arc::new(sources), 4096);
    assert!(matches!(tree.open_stream(Path::new("/repo/image.svg")),
        Err(SourceError::Changed { path }) if path == Path::new("/repo/image.svg")));
}

#[test]
fn a_small_pointer_uses_a_streamed_converted_digest() {
    let path = RepoPath::parse("image.lfs").unwrap();
    let index = Arc::new(TreeIndex {
        entries: [(
            path.clone(),
            Entry {
                path,
                mode: Mode::File,
                size: 128,
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
            .next_call(matching!((path) if path.as_str() == "image.lfs"))
            .returns(Ok("converted-content-hash".into())),
    ));
    let tree: &dyn SourceTree = &GitTree::new("/repo".into(), Arc::new(sources), 4096);
    assert_eq!(
        tree.digest(Path::new("/repo/image.lfs")).unwrap(),
        "converted-content-hash"
    );
}

#[test]
fn opaque_delivery_streams_without_reading_the_blob_first() {
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
        SourcesMock::digest_with_length
            .next_call(matching!((paths) if paths.len() == 1 && paths[0].as_str() == "image.svg"))
            .returns(Ok(vec![Ok(SourceDigest {
                hash: digest(b"opaque"),
                length: Some(6),
            })])),
        SourcesMock::stream
            .next_call(matching!((path, _, _) if path.as_str() == "image.svg"))
            .answers(&|_, _, output, _| {
                output.write_all(b"opaque").unwrap();
                Ok(6)
            }),
    ));
    let tree: &dyn SourceTree = &GitTree::new("/repo".into(), Arc::new(sources), 4096);
    let path = Path::new("/repo/image.svg");
    let mut stream = tree.open_stream(path).unwrap();
    let mut output = Vec::new();
    stream
        .copy_verified(path, &digest(b"opaque"), &mut output)
        .unwrap();
    assert_eq!(output, b"opaque");
}

#[test]
fn a_failed_digest_marks_only_its_own_asset_unavailable() {
    let entries = (0..3)
        .map(|index| {
            let path = RepoPath::parse(&format!("{index}.svg")).unwrap();
            (
                path.clone(),
                Entry {
                    path,
                    mode: Mode::File,
                    size: 1,
                    object: ObjectId::parse(&"a".repeat(40)).unwrap(),
                },
            )
        })
        .collect();
    let index = Arc::new(TreeIndex { entries });
    let sources = Unimock::new((
        SourcesMock::index
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| Ok(index.clone()))),
        SourcesMock::digest_with_length
            .next_call(matching!((paths) if paths.len() == 3))
            .returns(Ok(vec![
                Ok(SourceDigest {
                    hash: digest(b"a"),
                    length: Some(1),
                }),
                Err(crate::error::Error::Git {
                    source: mokly_git::error::Error::Conversion {
                        path: "1.svg".into(),
                        source: Box::new(mokly_git::error::Error::CheckoutFailed {
                            stderr: Vec::new(),
                        }),
                    },
                }),
                Ok(SourceDigest {
                    hash: digest(b"c"),
                    length: Some(1),
                }),
            ])),
    ));
    let tree = GitTree::new("/repo".into(), Arc::new(sources), 4096);
    let paths: Vec<_> = (0..3)
        .map(|index| Path::new("/repo").join(format!("{index}.svg")))
        .collect();
    let mut results = tree.digest_unretained_batch(&paths).into_iter();
    assert_eq!(results.next().unwrap().unwrap(), digest(b"a"));
    assert!(
        matches!(results.next().unwrap(), Err(SourceError::Unavailable { path, .. }) if path == paths[1])
    );
    assert_eq!(results.next().unwrap().unwrap(), digest(b"c"));
    assert_eq!(tree.digest_unretained(&paths[0]).unwrap(), digest(b"a"));
    assert!(matches!(
        tree.digest_unretained(&paths[1]),
        Err(SourceError::Unavailable { .. })
    ));
    assert_eq!(tree.digest_unretained(&paths[2]).unwrap(), digest(b"c"));
    assert_eq!(tree.unavailable.lock().unwrap().len(), 1);
}
