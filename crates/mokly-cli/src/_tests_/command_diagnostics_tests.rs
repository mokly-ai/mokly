//! Diagnostic output preserves each source and a supplied JavaScript stack.

use mokly_cli::build::BuildError;
use mokly_cli::publication::error::Error;
use mokly_cli::redaction::Redactor;
use mokly_graph::error::GraphError;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};

use super::causes;

#[test]
fn the_cause_chain_keeps_javascript_frames_and_redacts_every_line() {
    let error = Error::Build {
        failure: Box::new(BuildError::Interrupted {
            source: Box::new(BuildError::Rendering {
                source: Box::new(GraphError::Runtime {
                    source: RuntimeDiagnostic {
                        code: RuntimeCode::Render,
                        message:
                            "consumer private-token failed\n    at render (private-token.js:3:2)"
                                .into(),
                    },
                }),
                warnings: vec![],
            }),
        }),
    };
    let text = causes(&error, &Redactor::collect(&[], Some("private-token")));
    assert_eq!(
        text,
        "Diagnostic causes:\n  rendering failed\n  consumer [redacted] failed\n      at render ([redacted].js:3:2)\n"
    );
    assert!(!text.contains("Backtrace"));
}

#[test]
fn combined_failures_keep_each_original_cause_on_its_own_line() {
    let error = BuildError::Shutdown {
        primary: Box::new(BuildError::Cancelled),
        shutdown: Box::new(BuildError::Viewer),
    };
    assert_eq!(
        causes(&error, &Redactor::default()),
        "Diagnostic causes:\n  Render shutdown failed\n  build cancelled\n  Build or reinstall the matching @mokly/viewer package.\n"
    );
}
