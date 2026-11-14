//! Git asset copies keep one bounded chunk and reject changed converted bytes.

use std::io::{self, Write};
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

fn tree(captured: &[u8], delivered: Vec<u8>) -> GitTree {
    let path = RepoPath::parse("image.svg").unwrap();
    let index = Arc::new(TreeIndex {
        entries: [(
            path.clone(),
            Entry {
                path,
                mode: Mode::File,
                size: captured.len(),
                object: ObjectId::parse(&"a".repeat(40)).unwrap(),
            },
        )]
        .into(),
    });
    let sources = Unimock::new((
        SourcesMock::index.each_call(matching!()).answers_arc(Arc::new(move |_| Ok(index.clone()))),
        SourcesMock::digest_with_length.next_call(matching!((paths) if paths.len() == 1 && paths[0].as_str() == "image.svg"))
            .returns(Ok(vec![Ok(SourceDigest { hash: digest(captured), length: Some(captured.len()) })])),
        SourcesMock::stream.next_call(matching!((path, _, limit) if path.as_str() == "image.svg" && *limit == 64 * 1024 * 1024))
            .answers_arc(Arc::new(move |_, _, output, _| {
                let result = output.write_all(&delivered);
                match result {
                    Ok(()) => Ok(delivered.len()),
                    Err(source) => Err(crate::error::Error::Internal(crate::error::InternalError::Io { source })),
                }
            })),
    ));
    GitTree::new("/repo".into(), Arc::new(sources), 4096)
}

#[derive(Default)]
struct Chunks {
    bytes: Vec<u8>,
    writes: usize,
}

impl Write for Chunks {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        assert!(bytes.len() <= 64 * 1024);
        self.writes += 1;
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn delivery_larger_than_the_copy_buffer_never_calls_read_many() {
    let bytes = vec![42; 3 * 64 * 1024 + 11];
    let tree = tree(&bytes, bytes.clone());
    let path = Path::new("/repo/image.svg");
    let mut stream = tree.open_stream(path).unwrap();
    assert_eq!(stream.length(), bytes.len() as u64);
    let mut output = Chunks::default();
    stream
        .copy_verified(path, &digest(&bytes), &mut output)
        .unwrap();
    assert_eq!(output.bytes, bytes);
    assert_eq!(output.writes, 4);
    assert!(
        !tree
            .cache
            .lock()
            .unwrap()
            .contains(&RepoPath::parse("image.svg").unwrap())
    );
}

#[test]
fn delivery_rejects_a_digest_or_length_that_differs_from_the_digest_pass() {
    let path = Path::new("/repo/image.svg");
    for bytes in [b"change".to_vec(), b"short".to_vec(), b"longer!".to_vec()] {
        let tree = tree(b"opaque", bytes);
        let mut stream = tree.open_stream(path).unwrap();
        assert_eq!(stream.length(), 6);
        assert!(
            matches!(stream.copy_verified(path, &digest(b"opaque"), &mut Vec::new()),
            Err(SourceError::Changed { path: changed }) if changed == path)
        );
    }
}
