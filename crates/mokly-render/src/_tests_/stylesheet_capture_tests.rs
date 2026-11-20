//! Captured core reads replay their exact buffers while opaque digests stay unretained.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_css::types::StylesheetBundler;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::stylesheet_cache::CachedStylesheets;
use crate::stylesheet_capture::RecordingTree;
use crate::stylesheet_compiler::{Compilation, CompileRoot};
use crate::stylesheet_store::StylesheetCache;

use super::stylesheet_evidence_tests::bundle;
use super::stylesheet_support::root;

const HASH: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

#[test]
fn core_byte_reads_replay_the_original_witness_on_a_shared_hit() {
    let observations = Arc::new(Mutex::new(Vec::new()));
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::read
            .some_call(matching!((path) if *path == Path::new("/repo/package.json")))
            .returns(Ok(b"abc".to_vec())),
        SourceTreeMock::digest
            .some_call(matching!((path) if *path == Path::new("/repo/package.json")))
            .returns(Ok(HASH.into())),
        SourceTreeMock::observe_inputs
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let observations = observations.clone();
                move |_, path, baselines| {
                    observations
                        .lock()
                        .unwrap()
                        .push((path.to_owned(), baselines.clone()));
                    Ok(())
                }
            })),
    )));
    let recording = RecordingTree::new(tree.clone(), "/repo".into());
    assert_eq!(
        recording.read(Path::new("/repo/package.json")).unwrap(),
        b"abc"
    );
    let mut bundle = bundle();
    bundle.read_evidence.inputs.clear();
    let shared = Arc::new(Mutex::new(StylesheetCache::default()));
    let first = CachedStylesheets::new(
        Arc::new(Unimock::new(CompileRoot.some_call(matching!(_)).returns(
            Ok(Compilation {
                bundle,
                capture: recording.take(),
            }),
        ))),
        tree.clone(),
        "/repo".into(),
        "same".into(),
        shared.clone(),
    );
    let second = CachedStylesheets::new(
        Arc::new(Unimock::new(())),
        tree,
        "/repo".into(),
        "same".into(),
        shared,
    );
    assert_eq!(first.bundle(&root("main.css")).unwrap().css, "a{color:red}");
    assert_eq!(
        second.bundle(&root("main.css")).unwrap().css,
        "a{color:red}"
    );
    let expected = (
        Path::new("/repo/package.json").to_owned(),
        BTreeSet::from([ReadBaseline::ObservedWholeFile(HASH.into())]),
    );
    assert_eq!(*observations.lock().unwrap(), [expected.clone(), expected]);
}

#[test]
fn an_opaque_digest_validates_without_an_ordinary_read_or_read_witness() {
    let tree = Arc::new(Unimock::new(
        SourceTreeMock::digest_unretained
            .each_call(matching!((path) if *path == Path::new("/repo/icon.svg")))
            .answers(&|_, _| Ok(HASH.into()))
            .n_times(2),
    ));
    let recording = RecordingTree::new(tree.clone(), "/repo".into());
    assert_eq!(
        recording
            .digest_unretained(Path::new("/repo/icon.svg"))
            .unwrap(),
        HASH
    );
    let captured = recording.take();
    assert!(captured.evidence.inputs.is_empty());
    assert!(captured.stamp.matches(tree.as_ref()));
}

#[test]
fn a_directory_replaced_by_a_symlink_rejects_the_captured_projection() {
    let path = Path::new("/repo/styles");
    let original = Node {
        identity: path.into(),
        lexical_kind: FileKind::Directory,
        kind: FileKind::Directory,
    };
    let tree = Arc::new(Unimock::new(
        SourceTreeMock::project
            .some_call(matching!(_))
            .returns(Ok(Some(original.clone()))),
    ));
    let recording = RecordingTree::new(tree, "/repo".into());
    assert_eq!(recording.project(path).unwrap(), Some(original));
    let changed = Unimock::new(
        SourceTreeMock::project
            .some_call(matching!(_))
            .returns(Ok(Some(Node {
                identity: path.into(),
                lexical_kind: FileKind::Symlink,
                kind: FileKind::Directory,
            }))),
    );
    assert!(!recording.take().stamp.matches(&changed));
}
