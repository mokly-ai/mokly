//! Asset confinement precedes every opaque byte read and digest.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_source_interface::error::SourceError;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::compiler::Compiler;
use crate::error::{AssetFailure, CssError};
use crate::resolver::SourceResolver;
use crate::types::{IdentityProcessor, StylesheetBundler, StylesheetRoot};

#[test]
fn escaping_asset_fails_before_any_digest_read() {
    let reads = Arc::new(Mutex::new(Vec::<PathBuf>::new()));
    let recorded = reads.clone();
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                let escape = path == Path::new("/repo/images/escape.svg");
                Ok(Some(Node {
                    identity: if escape {
                        "/outside/escape.svg".into()
                    } else {
                        path.into()
                    },
                    lexical_kind: if escape {
                        FileKind::Symlink
                    } else {
                        FileKind::File
                    },
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::read
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(if path == Path::new("/repo/main.css") {
                    b".hero{background:url('./images/escape.svg')}".to_vec()
                } else {
                    b".hero{background:url('./images/safe.svg')}".to_vec()
                })
            }),
        SourceTreeMock::digest_unretained_batch
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, paths| {
                recorded.lock().unwrap().extend_from_slice(paths);
                paths.iter().map(|_| Ok("hash".into())).collect()
            }))
            .at_least_times(0),
    )));
    let compiler = Compiler {
        tree: tree.clone(),
        repo_root: "/repo".into(),
        resolver: Arc::new(SourceResolver {
            settings: Default::default(),
            tree,
            repo_root: "/repo".into(),
        }),
        processor: Arc::new(IdentityProcessor),
    };
    compiler
        .bundle(&StylesheetRoot {
            path: "safe.css".into(),
            stylesheets: vec!["safe.css".into()],
            excluded: Default::default(),
            local_css: true,
        })
        .unwrap();
    reads.lock().unwrap().clear();
    let error = compiler
        .bundle(&StylesheetRoot {
            path: "main.css".into(),
            stylesheets: vec!["main.css".into()],
            excluded: Default::default(),
            local_css: true,
        })
        .unwrap_err();
    assert!(matches!(
        error,
        CssError::Asset {
            kind: AssetFailure::File,
            ..
        }
    ));
    assert_eq!(*reads.lock().unwrap(), Vec::<PathBuf>::new());
}

#[test]
fn projection_failure_cannot_preempt_an_earlier_asset_reference_error() {
    let calls = Arc::new(AtomicUsize::new(0));
    let recorded = calls.clone();
    let tree = Arc::new(
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
            SourceTreeMock::read.some_call(matching!(_)).returns(Ok(
                b".a{background:url('/absolute.svg')}.b{background:url('./later.svg')}".to_vec(),
            )),
            SourceTreeMock::project_batch
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, paths| {
                    recorded.fetch_add(1, Ordering::SeqCst);
                    paths
                        .iter()
                        .map(|path| {
                            Err(SourceError::Unavailable {
                                path: path.into(),
                                message: "later metadata failure".into(),
                            })
                        })
                        .collect()
                })),
        ))
        .no_verify_in_drop(),
    );
    let compiler = Compiler {
        tree: tree.clone(),
        repo_root: "/repo".into(),
        resolver: Arc::new(SourceResolver {
            settings: Default::default(),
            tree,
            repo_root: "/repo".into(),
        }),
        processor: Arc::new(IdentityProcessor),
    };
    let error = compiler
        .bundle(&StylesheetRoot {
            path: "main.css".into(),
            stylesheets: vec!["main.css".into()],
            excluded: Default::default(),
            local_css: true,
        })
        .unwrap_err();
    assert!(matches!(
        error,
        CssError::Asset {
            kind: AssetFailure::Absolute,
            ..
        }
    ));
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
