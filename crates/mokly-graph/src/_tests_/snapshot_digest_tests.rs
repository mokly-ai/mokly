//! Digest-only inputs retain hashes without retaining source byte arrays.

use std::path::Path;
use std::sync::Arc;

use mokly_model::material::digest;
use mokly_source_interface::tree::{SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::closure::{ClosureBuilder, Walker};
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::reference_index::MemoryReferenceIndex;

use super::SourceSnapshot;

#[test]
fn digest_only_reads_keep_no_bytes_and_read_each_digest_once() {
    let bytes: Arc<[u8]> = vec![42; 4096].into();
    let hash = digest(&bytes);
    let expected = hash.clone();
    let source = Unimock::new(
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(hash.clone())))
            .n_times(1),
    );
    let snapshot = SourceSnapshot::new(Arc::new(source));
    for _ in 0..2 {
        assert_eq!(
            snapshot
                .digest(Path::new("/repo/assets/image.png"))
                .unwrap(),
            expected
        );
    }
    assert!(snapshot.reads.lock().unwrap().is_empty());
}

#[test]
fn binary_resource_validation_keeps_no_snapshot_bytes() {
    let source = Unimock::new(
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok(digest(&vec![42; 4096]))),
    );
    let snapshot = Arc::new(SourceSnapshot::new(Arc::new(source)));
    let policy = Unimock::new(
        PublicPolicyMock::check
            .next_call(matching!("assets/image.png"))
            .returns(Ok(PublicFile {
                path: "assets/image.png".into(),
                absolute: "/repo/assets/image.png".into(),
            })),
    );
    let walker = Walker {
        observer: None,
        tree: snapshot.clone(),
        policy: Arc::new(policy),
        generated: Arc::new(Unimock::new(())),
        index: Arc::new(MemoryReferenceIndex::default()),
    };
    let closure = walker
        .collect("home/index.mobile.html", &[], &["assets/image.png".into()])
        .unwrap();
    assert!(closure.files.contains("assets/image.png"));
    assert!(closure.edges["static/assets/image.png"].is_empty());
    assert!(snapshot.reads.lock().unwrap().is_empty());
}
