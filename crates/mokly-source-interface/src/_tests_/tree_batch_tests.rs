//! The batch default preserves each source adapter's per-path digest results.

use std::io;
use std::path::{Path, PathBuf};

use unimock::{MockFn, Unimock, matching};

use crate::error::Result;
use crate::error::SourceError;
use crate::tree::{Child, Node, SourceTree, SourceTreeMock};

struct PerPath(Unimock);

impl SourceTree for PerPath {
    fn project(&self, path: &Path) -> Result<Option<Node>> {
        self.0.project(path)
    }
    fn children(&self, path: &Path) -> Result<Vec<Child>> {
        self.0.children(path)
    }
    fn read(&self, path: &Path) -> Result<Vec<u8>> {
        self.0.read(path)
    }
    fn digest_unretained(&self, path: &Path) -> Result<String> {
        self.0.digest_unretained(path)
    }
}

#[test]
fn the_batch_default_keeps_order_and_does_not_stop_at_a_failed_digest() {
    let paths = [PathBuf::from("a"), PathBuf::from("b"), PathBuf::from("c")];
    let tree = PerPath(Unimock::new((
        SourceTreeMock::digest_unretained
            .next_call(matching!((path) if *path == Path::new("a")))
            .returns(Ok("a-hash".into())),
        SourceTreeMock::digest_unretained
            .next_call(matching!((path) if *path == Path::new("b")))
            .returns(Err(SourceError::Io {
                operation: "fixture digest",
                path: paths[1].clone(),
                source: io::ErrorKind::NotFound.into(),
            })),
        SourceTreeMock::digest_unretained
            .next_call(matching!((path) if *path == Path::new("c")))
            .returns(Ok("c-hash".into())),
    )));
    let mut results = tree.digest_unretained_batch(&paths).into_iter();
    assert_eq!(results.next().unwrap().unwrap(), "a-hash");
    assert!(results.next().unwrap().unwrap_err().is_vanished());
    assert_eq!(results.next().unwrap().unwrap(), "c-hash");
    assert!(tree.digest_unretained_batch(&[]).is_empty());
}
