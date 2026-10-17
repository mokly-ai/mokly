//! Captured input hashes share one digest path and ignore unread projections.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_model::output::validation::digest;
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::fingerprint::{CapturedTree, InputTree};

#[test]
fn captured_digest_inputs_keep_no_byte_reads_and_verify_live_hashes() {
    let source = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    kind: FileKind::File,
                    lexical_kind: FileKind::File,
                }))
            })
            .n_times(3),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .answers(&|_, _| Ok("before".into()))
            .n_times(2),
        SourceTreeMock::digest
            .next_call(matching!(_))
            .returns(Ok("after".into())),
    ));
    let capture = CapturedTree::new(Arc::new(source));
    capture
        .capture(
            Path::new("/repo"),
            &["source.js".into()],
            &Default::default(),
        )
        .unwrap();
    assert_eq!(
        capture.digest(Path::new("/repo/source.js")).unwrap(),
        "before"
    );
    capture.verify().unwrap();
    assert!(
        matches!(capture.verify(), Err(Error::InputsChanged {path}) if path == Path::new("/repo/source.js"))
    );
}

#[test]
fn captured_public_reads_forward_and_verify_hashes_without_private_byte_retention() {
    let source = Unimock::new((
        SourceTreeMock::prefetch
            .next_call(matching!((paths) if paths == &[Path::new("/repo/asset.css").to_owned()]))
            .returns(Ok(())),
        SourceTreeMock::read_public
            .each_call(matching!((path) if *path == Path::new("/repo/asset.css")))
            .answers(&|_, _| Ok(b"a{}".to_vec()))
            .n_times(2),
        SourceTreeMock::digest
            .next_call(matching!((path) if *path == Path::new("/repo/asset.css")))
            .returns(Ok(digest(b"a{}"))),
    ));
    let capture: &dyn InputTree = &CapturedTree::new(Arc::new(source));
    capture.prefetch(&["/repo/asset.css".into()]).unwrap();
    assert_eq!(
        capture.read_public(Path::new("/repo/asset.css")).unwrap(),
        b"a{}"
    );
    assert_eq!(
        capture.read_public(Path::new("/repo/asset.css")).unwrap(),
        b"a{}"
    );
    capture.verify().unwrap();
}

#[test]
fn an_unread_projection_outside_the_input_set_is_not_rechecked() {
    let source = Unimock::new(
        SourceTreeMock::project
            .next_call(matching!((path) if *path == Path::new("/repo/unrelated.txt")))
            .returns(Ok(Some(Node {
                identity: "/repo/unrelated.txt".into(),
                kind: FileKind::File,
                lexical_kind: FileKind::File,
            }))),
    );
    let capture = CapturedTree::new(Arc::new(source));
    capture.project(Path::new("/repo/unrelated.txt")).unwrap();
    capture.verify().unwrap();
}

#[test]
fn sidecar_digests_reject_edits_before_capture_and_remain_the_live_baseline() {
    for changed_before_capture in [false, true] {
        let captured = if changed_before_capture {
            "after"
        } else {
            "before"
        };
        let source = Unimock::new((
            SourceTreeMock::project
                .each_call(matching!((path) if *path == Path::new("/repo/helper.ts")))
                .answers(&|_, path| {
                    Ok(Some(Node {
                        identity: path.into(),
                        kind: FileKind::File,
                        lexical_kind: FileKind::File,
                    }))
                }),
            SourceTreeMock::digest
                .next_call(matching!((path) if *path == Path::new("/repo/helper.ts")))
                .returns(Ok(captured.into())),
            SourceTreeMock::digest
                .next_call(matching!((path) if *path == Path::new("/repo/helper.ts")))
                .returns(Ok("after".into())),
        ));
        let tree = CapturedTree::new(Arc::new(source));
        let result = tree.capture(
            Path::new("/repo"),
            &["helper.ts".into()],
            &BTreeMap::from([("helper.ts".into(), "before".into())]),
        );
        if changed_before_capture {
            assert!(matches!(result, Err(Error::InputsChanged { path })
                if path == Path::new("/repo/helper.ts")));
        } else {
            result.unwrap();
        }
        assert!(matches!(tree.verify(), Err(Error::InputsChanged { path })
            if path == Path::new("/repo/helper.ts")));
    }
}
