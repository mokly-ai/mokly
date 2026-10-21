//! Equal bytes cannot hide an opaque input alias changing its resolved source identity.

use std::path::Path;
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::input_stamp::InputStamp;

fn tree(identity: &'static str, digest: &'static str) -> Unimock {
    Unimock::new((
        SourceTreeMock::project
            .each_call(matching!((path) if *path == Path::new("/repo/alias.svg")))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Some(Node {
                    identity: identity.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            })),
        SourceTreeMock::digest_unretained
            .next_call(matching!(_))
            .returns(Ok(digest.into())),
    ))
}

#[test]
fn asset_stamps_require_both_digest_and_source_identity_without_byte_reads() {
    let before = tree("/repo/first.svg", "hash");
    let mut stamp = InputStamp::default();
    stamp.asset(&before, "/repo/alias.svg".into());
    assert!(stamp == stamp.current(&tree("/repo/first.svg", "hash")));
    assert!(stamp != stamp.current(&tree("/repo/second.svg", "hash")));
    assert!(stamp != stamp.current(&tree("/repo/first.svg", "new-hash")));
}

#[test]
fn observed_file_stamps_invalidate_same_path_same_byte_replacements() {
    let reader = |object: &'static str| {
        Unimock::new((
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, path| {
                    Ok(Some(Node {
                        identity: path.into(),
                        lexical_kind: FileKind::File,
                        kind: FileKind::File,
                    }))
                }),
            SourceTreeMock::file_object
                .next_call(matching!(_))
                .returns(Ok(Some(object.into()))),
        ))
    };
    let mut stamp = InputStamp::default();
    stamp.identity(&reader("device:first"), "/repo/input.txt".into());
    assert!(stamp == stamp.current(&reader("device:first")));
    assert!(stamp != stamp.current(&reader("device:replacement")));
}
