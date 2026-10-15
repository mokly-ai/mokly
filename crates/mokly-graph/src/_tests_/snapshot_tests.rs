//! Snapshot hits share storage and different file reads can enter concurrently.

use std::path::Path;
use std::sync::{Arc, Barrier};
use std::thread;

use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::source_snapshot::SourceSnapshot;

#[test]
fn shared_hits_reuse_the_same_allocation() {
    let source = Arc::new(Unimock::new(
        SourceTreeMock::read
            .next_call(matching!(_))
            .returns(Ok(vec![7; 4096])),
    ));
    let snapshot: &dyn SourceTree = &SourceSnapshot::new(source);
    let first = snapshot.read_shared(Path::new("/repo/a")).unwrap();
    let second = snapshot.read_shared(Path::new("/repo/a")).unwrap();
    assert!(Arc::ptr_eq(&first, &second));
    assert_eq!(first.as_ref(), [7; 4096]);
}

#[test]
fn independent_source_reads_enter_before_either_read_returns() {
    let both = Arc::new(Barrier::new(2));
    let source = Arc::new(Unimock::new(
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                both.wait();
                Ok(path.to_string_lossy().as_bytes().to_vec())
            })),
    ));
    let snapshot = SourceSnapshot::new(source);
    thread::scope(|scope| {
        let first = scope.spawn(|| snapshot.read_shared(Path::new("/repo/a")).unwrap());
        let second = scope.spawn(|| snapshot.read_shared(Path::new("/repo/b")).unwrap());
        assert_eq!(first.join().unwrap().as_ref(), b"/repo/a");
        assert_eq!(second.join().unwrap().as_ref(), b"/repo/b");
    });
}
