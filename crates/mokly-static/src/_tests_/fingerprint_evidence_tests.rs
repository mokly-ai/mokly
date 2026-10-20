//! Controlled read/capture order and conflicting versions need no clocks or filesystem.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_source_interface::read_evidence::ReadBaseline;
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::fingerprint::{CapturedTree, InputTree};

fn fixture() -> (Arc<CapturedTree>, Arc<Mutex<String>>) {
    let version = Arc::new(Mutex::new(String::from("old")));
    let current = version.clone();
    let live = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| Ok(current.lock().unwrap().clone()))),
    ));
    (Arc::new(CapturedTree::new(Arc::new(live))), version)
}

#[test]
fn observed_bytes_are_checked_before_callbacks_even_when_the_snapshot_has_old_bytes() {
    for already_captured in [false, true] {
        let (tree, version) = fixture();
        let path = Path::new("/repo/tokens.txt");
        if already_captured {
            assert_eq!(tree.digest(path).unwrap(), "old");
        }
        let snapshot = SourceSnapshot::new(tree.clone());
        snapshot
            .observe_input(path, &ReadBaseline::ObservedWholeFile("old".into()))
            .unwrap();
        *version.lock().unwrap() = "new".into();
        assert!(
            matches!(tree.capture(Path::new("/repo"), &[], &Default::default()), Err(Error::InputsChanged { path: changed }) if changed == path)
        );
    }
}

#[test]
fn a_late_baseline_never_overwrites_an_observed_version_or_completes_coverage() {
    let (tree, version) = fixture();
    let path = Path::new("/selected/node_modules/plugin/helper.cjs");
    tree.observe_input(path, &ReadBaseline::ObservedWholeFile("old".into()))
        .unwrap();
    *version.lock().unwrap() = "new".into();
    tree.observe_input(path, &ReadBaseline::Late("new".into()))
        .unwrap();
    tree.observe_input(path, &ReadBaseline::ObservedWholeFile("new".into()))
        .unwrap();
    assert!(
        matches!(tree.capture(Path::new("/repo"), &[], &Default::default()), Err(Error::InputsChanged { path: changed }) if changed == path)
    );
}

#[test]
fn opaque_reads_keep_late_capture_but_later_edits_still_fail() {
    let (tree, version) = fixture();
    let path = Path::new("/repo/opaque.txt");
    *version.lock().unwrap() = "after-opaque-read".into();
    tree.observe_input(path, &ReadBaseline::Late("after-opaque-read".into()))
        .unwrap();
    tree.capture(Path::new("/repo"), &[], &Default::default())
        .unwrap();
    tree.verify().unwrap();
    *version.lock().unwrap() = "after-capture".into();
    assert!(
        matches!(tree.verify(), Err(Error::InputsChanged { path: changed }) if changed == path)
    );
}

#[test]
fn worker_replacement_and_cache_replay_do_not_erase_earlier_observations() {
    let (tree, version) = fixture();
    let path = Path::new("/repo/tokens.txt");
    let cached = ReadBaseline::ObservedWholeFile("old".into());
    tree.observe_input(path, &cached).unwrap();
    tree.capture(Path::new("/repo"), &[], &Default::default())
        .unwrap();
    *version.lock().unwrap() = "replacement".into();
    tree.observe_input(path, &ReadBaseline::ObservedWholeFile("replacement".into()))
        .unwrap();
    tree.observe_input(path, &cached).unwrap();
    assert!(matches!(tree.verify(), Err(Error::InputsChanged { .. })));
}

#[test]
fn pinned_base_witnesses_never_read_or_replace_the_matching_head_path() {
    let tree = CapturedTree::new(Arc::new(Unimock::new(())));
    let path = Path::new("/base/tokens.txt");
    tree.observe_pinned_input(
        path,
        &ReadBaseline::ObservedWholeFile("base".into()),
        "base",
    )
    .unwrap();
    tree.verify().unwrap();
    assert!(
        tree.observe_pinned_input(
            path,
            &ReadBaseline::ObservedWholeFile("changed".into()),
            "base"
        )
        .is_err()
    );
    assert!(
        matches!(tree.verify(), Err(Error::InputsChanged { path: changed }) if changed == path)
    );
}
