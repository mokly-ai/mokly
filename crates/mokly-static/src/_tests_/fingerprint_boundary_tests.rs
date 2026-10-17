//! Initial capture and recheck use metadata and digests, with stable IO failure markers.

use std::io;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::config_types::{Config, ResolvedConfig, ResolvedRoot, RootConfig};
use mokly_catalogue::discovery::{Discoverer, Discovery};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{Child, FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::fingerprint::{CapturedTree, InputTree};

fn config() -> ResolvedConfig {
    ResolvedConfig {
        input: Config::default(),
        repo_root: "/repo".into(),
        file: "/repo/mokly.config.json".into(),
        authored_inputs: vec!["/repo/renderer.ts".into()],
        roots: vec![ResolvedRoot {
            input: RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            },
            directory: "/repo/specs".into(),
            identity: "/repo/specs".into(),
        }],
    }
}

fn denied(path: &Path) -> SourceError {
    SourceError::Io {
        operation: "read",
        path: path.into(),
        source: io::Error::from(io::ErrorKind::PermissionDenied),
    }
}

fn node(path: &Path) -> Node {
    let kind = if path.ends_with("specs") {
        FileKind::Directory
    } else {
        FileKind::File
    };
    Node {
        identity: path.into(),
        kind,
        lexical_kind: kind,
    }
}

#[test]
fn begin_and_verify_forbid_all_byte_reads() {
    let source = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| Ok(Some(node(path))))
            .n_times(8),
        SourceTreeMock::children
            .each_call(matching!((path) if *path == Path::new("/repo/specs")))
            .answers(&|_, _| {
                Ok(vec![Child {
                    name: "home.screen.html".into(),
                    kind: FileKind::File,
                }])
            })
            .n_times(2),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("digest".into()))
            .n_times(6),
    ));
    let tree = CapturedTree::new(Arc::new(source));
    tree.begin(&config(), &[]).unwrap();
    tree.verify().unwrap();
}

#[test]
fn unreadable_directory_markers_defer_to_discovery_and_fail_only_when_changed() {
    let source = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| Ok(Some(node(path)))),
        SourceTreeMock::children
            .next_call(matching!(_))
            .answers(&|_, path| Err(denied(path)))
            .n_times(3),
        SourceTreeMock::children
            .next_call(matching!(_))
            .returns(Ok(vec![])),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("digest".into())),
    ));
    let tree = Arc::new(CapturedTree::new(Arc::new(source)));
    tree.begin(&config(), &[]).unwrap();
    let error = Discoverer { tree: tree.clone() }
        .discover(&config(), None)
        .unwrap_err();
    assert!(error.to_string().contains("specs: EACCES"), "{error}");
    tree.verify().unwrap();
    assert!(matches!(tree.verify(), Err(Error::InputsChanged { path })
        if path == Path::new("/repo/specs")));
}

#[test]
fn a_vanished_directory_is_skipped_until_its_membership_changes() {
    let source = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| Ok(Some(node(path)))),
        SourceTreeMock::children
            .next_call(matching!(_))
            .answers(&|_, path| {
                Err(SourceError::Io {
                    operation: "children",
                    path: path.into(),
                    source: io::Error::from(io::ErrorKind::NotFound),
                })
            })
            .n_times(2),
        SourceTreeMock::children
            .next_call(matching!(_))
            .returns(Ok(vec![Child {
                name: "home.screen.html".into(),
                kind: FileKind::File,
            }])),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers(&|_, _| Ok("digest".into())),
    ));
    let tree = CapturedTree::new(Arc::new(source));
    tree.begin(&config(), &[]).unwrap();
    tree.verify().unwrap();
    assert!(matches!(tree.verify(), Err(Error::InputsChanged { path })
        if path == Path::new("/repo/specs/home.screen.html")));
}

#[test]
fn unreadable_file_markers_survive_inventory_capture_until_the_digest_changes() {
    let reads = AtomicUsize::new(0);
    let source = Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| Ok(Some(node(path)))),
        SourceTreeMock::children
            .each_call(matching!(_))
            .answers(&|_, _| {
                Ok(vec![Child {
                    name: "excluded.screen.html".into(),
                    kind: FileKind::File,
                }])
            }),
        SourceTreeMock::digest
            .each_call(matching!((path) if *path == Path::new("/repo/specs/excluded.screen.html")))
            .answers_arc(Arc::new(move |_, path| {
                if reads.fetch_add(1, Ordering::Relaxed) < 3 {
                    Err(denied(path))
                } else {
                    Ok("repaired".into())
                }
            }))
            .n_times(4),
        SourceTreeMock::digest
            .each_call(matching!((path) if !path.starts_with("/repo/specs")))
            .answers(&|_, _| Ok("digest".into())),
    ));
    let tree = CapturedTree::new(Arc::new(source));
    tree.begin(&config(), &[]).unwrap();
    tree.capture(
        Path::new("/repo"),
        &["specs/excluded.screen.html".into()],
        &Default::default(),
    )
    .unwrap();
    tree.verify().unwrap();
    assert!(matches!(tree.verify(), Err(Error::InputsChanged { path })
        if path == Path::new("/repo/specs/excluded.screen.html")));
}
