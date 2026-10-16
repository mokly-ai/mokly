//! Unrelated disappearance and unreadable children do not fail source capture.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_source_interface::tree::{FileKind, Node, SourceTree, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::filesystem::{Entry, FilesMock, Identity};
use crate::fingerprint::{CapturedTree, Fingerprints, InputTree, SourceFingerprints};
use crate::input_selection;

#[test]
fn vanished_and_unreadable_children_have_stable_membership() {
    let mocks = Unimock::new((
        FilesMock::project
            .next_call(matching!(_))
            .returns(Ok("/repo".into())),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo")))
            .returns(Ok(Some(Entry::Directory(Identity {
                native: (1, 1),
                created: None,
            })))),
        FilesMock::children.next_call(matching!(_)).returns(Ok(vec![
            "/repo/vanished".into(),
            "/repo/locked".into(),
            "/repo/private".into(),
            "/repo/stat-denied".into(),
        ])),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo/vanished")))
            .returns(Ok(None)),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo/locked")))
            .returns(Ok(Some(Entry::File(1)))),
        FilesMock::hash
            .next_call(matching!(_))
            .returns(Err(Error::Unexpected {
                path: "/repo/locked".into(),
            })),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo/private")))
            .returns(Ok(Some(Entry::Directory(Identity {
                native: (1, 2),
                created: None,
            })))),
        FilesMock::children
            .next_call(matching!(_))
            .returns(Err(Error::Unexpected {
                path: "/repo/private".into(),
            })),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo/stat-denied")))
            .returns(Err(Error::Unexpected {
                path: "/repo/stat-denied".into(),
            })),
    ));
    let result = SourceFingerprints {
        files: Arc::new(mocks),
    }
    .capture(Path::new("/repo"), &[])
    .unwrap();
    assert!(!result.contains_key(Path::new("/repo/vanished")));
    assert_eq!(result[Path::new("/repo/locked")], "unreadable");
    assert_eq!(result[Path::new("/repo/private")], "unreadable");
    assert_eq!(result[Path::new("/repo/stat-denied")], "unreadable");
}

#[test]
fn a_projected_root_spelling_keeps_selected_changes_in_the_logical_namespace() {
    let capture = |digest: &'static str| {
        let files = Unimock::new((
            FilesMock::project
                .next_call(matching!((path) if *path == Path::new("/logical")))
                .returns(Ok("/physical".into())),
            FilesMock::entry
                .next_call(matching!((path) if *path == Path::new("/physical")))
                .returns(Ok(Some(Entry::Directory(Identity {
                    native: (1, 1),
                    created: None,
                })))),
            FilesMock::children
                .next_call(matching!(_))
                .returns(Ok(vec!["/physical/logo.svg".into()])),
            FilesMock::entry
                .next_call(matching!((path) if *path == Path::new("/physical/logo.svg")))
                .returns(Ok(Some(Entry::File(3)))),
            FilesMock::hash
                .next_call(matching!(_))
                .returns(Ok(digest.into())),
        ));
        SourceFingerprints {
            files: Arc::new(files),
        }
        .capture(Path::new("/logical"), &[])
        .unwrap()
    };
    let config = ResolvedConfig {
        input: Config::default(),
        file: "/logical/mokly.config.json".into(),
        repo_root: "/logical".into(),
        roots: vec![],
        authored_inputs: vec![],
    };
    let error = input_selection::verify(
        &config,
        &[],
        &BTreeSet::from(["logo.svg".into()]),
        &capture("before"),
        &capture("after"),
    )
    .unwrap_err();
    assert!(
        matches!(error, Error::InputsChanged { path } if path == Path::new("/logical/logo.svg"))
    );
}

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
        .capture(Path::new("/repo"), &["source.js".into()])
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
