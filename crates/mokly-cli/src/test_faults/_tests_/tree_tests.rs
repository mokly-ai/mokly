//! Debug injection preserves the public streaming and batch source boundaries.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::{Faults, InjectedTree};

#[test]
fn public_reads_digests_and_prefetch_reach_the_injected_tree() {
    let paths = vec![PathBuf::from("/repo/large.bin")];
    let inner = Unimock::new((
        SourceTreeMock::prefetch
            .next_call(matching!(_))
            .returns(Ok(())),
        SourceTreeMock::read_public
            .next_call(matching!(_))
            .returns(Ok(b"public".to_vec())),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok("streamed digest".into())),
    ));
    let tree: &dyn SourceTree = &InjectedTree {
        inner: Arc::new(inner),
        faults: Faults { names: Vec::new() },
    };
    tree.prefetch(&paths).unwrap();
    assert_eq!(
        tree.read_public(Path::new("/repo/large.bin")).unwrap(),
        b"public"
    );
    assert_eq!(
        tree.digest(Path::new("/repo/large.bin")).unwrap(),
        "streamed digest"
    );
}
