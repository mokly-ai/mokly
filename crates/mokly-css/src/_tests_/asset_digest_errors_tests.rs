//! Opaque digest failures retain conversion diagnostics and cancellation.

use std::sync::Arc;

use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::compiler::Compiler;
use crate::error::{AssetFailure, CssError};
use crate::resolver::SourceResolver;
use crate::types::{IdentityProcessor, StylesheetBundler, StylesheetRoot};

fn failed_digest(cancelled: bool) -> CssError {
    let tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))
            }),
        SourceTreeMock::read
            .some_call(matching!(_))
            .returns(Ok(b".hero{background:url('./image.svg')}".to_vec())),
        SourceTreeMock::digest_unretained_batch
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, paths| {
                paths
                    .iter()
                    .map(|path| {
                        Err(if cancelled {
                            SourceError::Cancelled { path: path.into() }
                        } else {
                            SourceError::Unavailable {
                                path: path.into(),
                                message: "source bytes exceed 67108864 bytes".into(),
                            }
                        })
                    })
                    .collect()
            })),
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
            path: "main.css".into(),
            stylesheets: vec!["main.css".into()],
            excluded: Default::default(),
            local_css: true,
        })
        .unwrap_err()
}

#[test]
fn unavailable_asset_digest_preserves_adapter_message() {
    let error = failed_digest(false);
    assert!(
        matches!(&error, CssError::Asset { kind: AssetFailure::Unavailable, message }
        if message == "source bytes exceed 67108864 bytes"),
        "{error:?}"
    );
}

#[test]
fn cancelled_asset_digest_stops_css_preparation() {
    let error = failed_digest(true);
    assert!(
        matches!(
            &error,
            CssError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    ..
                }
            }
        ),
        "{error:?}"
    );
}
