//! Public resource bytes bypass the private source snapshot's retained read set.

use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::source_snapshot::SourceSnapshot;

#[test]
fn private_sources_are_pinned_but_public_resource_reads_are_not_retained() {
    let source = Unimock::new((
        SourceTreeMock::read
            .next_call(matching!(_))
            .returns(Ok(vec![1])),
        SourceTreeMock::read_public
            .next_call(matching!(_))
            .returns(Ok(vec![2])),
        SourceTreeMock::read_public
            .next_call(matching!(_))
            .returns(Ok(vec![3])),
    ));
    let snapshot: &dyn SourceTree = &SourceSnapshot::new(Arc::new(source));
    let path = Path::new("/repo/file");
    assert_eq!(snapshot.read(path).unwrap(), [1]);
    assert_eq!(snapshot.read(path).unwrap(), [1]);
    assert_eq!(snapshot.read_public(path).unwrap(), [2]);
    assert_eq!(snapshot.read_public(path).unwrap(), [3]);
}
