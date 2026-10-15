//! Every runtime failure keeps its base policy and diagnostic category through wrappers.

use mokly_catalogue::error::CatalogueError;
use mokly_compare::error::Error;
use mokly_css::error::CssError;
use mokly_graph::error::GraphError;
use mokly_html::error::HtmlError;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};

use crate::build::BuildChanges;
use crate::changes_diagnostics;

#[test]
fn every_runtime_category_has_an_explicit_historical_outcome() {
    for (code, reason) in [
        (RuntimeCode::Cancelled, None),
        (RuntimeCode::Protocol, None),
        (RuntimeCode::Timeout, Some("base runtime timed out")),
        (RuntimeCode::Unavailable, Some("base runtime unavailable")),
        (RuntimeCode::Version, Some("base runtime version mismatch")),
        (RuntimeCode::Configuration, Some("base validation failed")),
        (RuntimeCode::Build, Some("base validation failed")),
        (RuntimeCode::Bundle, Some("base validation failed")),
        (RuntimeCode::Render, Some("base validation failed")),
    ] {
        for layer in ["catalogue", "graph", "html", "css"] {
            let diagnostic = RuntimeDiagnostic {
                code,
                message: "authored diagnostic".into(),
            };
            let source = match layer {
                "catalogue" => Error::Catalogue {
                    source: CatalogueError::Runtime { source: diagnostic },
                },
                "html" => Error::Graph {
                    source: GraphError::Html {
                        source: HtmlError::Route {
                            route: "home/index.html".into(),
                            source: Box::new(HtmlError::Runtime { source: diagnostic }),
                        },
                    },
                },
                "css" => Error::Graph {
                    source: GraphError::Css {
                        source: CssError::Runtime { source: diagnostic },
                    },
                },
                _ => Error::Graph {
                    source: GraphError::Runtime { source: diagnostic },
                },
            };
            let error = Error::Base {
                commit: "a".repeat(40),
                source: Box::new(source),
            };
            match (reason, changes_diagnostics::unavailable(&error)) {
                (None, None) => assert!(
                    changes_diagnostics::failure_detail(&error).ends_with("authored diagnostic")
                ),
                (
                    Some(expected),
                    Some(BuildChanges::Unavailable {
                        reason,
                        diagnostics,
                        ..
                    }),
                ) => {
                    assert_eq!(reason, expected);
                    assert_eq!(diagnostics[0].message, "authored diagnostic");
                    assert_eq!(
                        diagnostics[0].code.presentation().0,
                        if code == RuntimeCode::Configuration {
                            "config-invalid"
                        } else {
                            "build-invalid"
                        }
                    );
                }
                _ => panic!("unexpected {code:?} at {layer}"),
            }
        }
    }
}

#[test]
fn a_fatal_runtime_failure_takes_precedence_over_historical_validation() {
    let error = Error::Base {
        commit: "a".repeat(40),
        source: Box::new(Error::Graph {
            source: GraphError::Attempt {
                failures: vec![
                    GraphError::Runtime {
                        source: RuntimeDiagnostic {
                            code: RuntimeCode::Build,
                            message: "invalid base input".into(),
                        },
                    },
                    GraphError::Runtime {
                        source: RuntimeDiagnostic {
                            code: RuntimeCode::Protocol,
                            message: "bad frame".into(),
                        },
                    },
                ],
                warnings: Vec::new(),
            },
        }),
    };
    assert!(changes_diagnostics::unavailable(&error).is_none());
    assert!(changes_diagnostics::failure_detail(&error).contains("bad frame"));
}
