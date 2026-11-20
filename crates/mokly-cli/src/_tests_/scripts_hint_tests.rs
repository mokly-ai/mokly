//! Scripts recovery stays complete in rich comparison failures and out of status reasons.

use std::path::Path;

use mokly_compare::error::Error;
use mokly_graph::error::GraphError;
use mokly_html::diagnostic_code::Code;
use mokly_server::error::ServerError;

use crate::build::BuildError;
use crate::output::{Mode, Style};
use crate::publication::error;
use crate::redaction::Redactor;
use crate::{build_output, publish_errors, serve_errors, serve_output};

fn base_failure() -> Error {
    Error::Base {
        commit: "a".repeat(40),
        scripts_off: true,
        source: Box::new(Error::Graph {
            source: GraphError::Invalid {
                route: "base/index.html".into(),
                message: "render failed".into(),
                code: Code::BuildInvalid,
            },
        }),
    }
}

fn build_failure() -> BuildError {
    BuildError::Comparison {
        base_ref: "origin/main".into(),
        source: Box::new(base_failure()),
        warnings: Vec::new(),
    }
}

#[test]
fn scripts_off_comparison_failures_render_one_full_recovery_at_eighty_columns() {
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 80,
    };
    let redactor = Redactor::default();
    let serve = serve_errors::failure(
        &style,
        &ServerError::Comparison {
            source: Box::new(base_failure()),
        },
        &redactor,
    );
    let build = build_output::failure(&style, &build_failure(), &redactor, Path::new("/repo"));
    let publish = publish_errors::command(
        &error::Error::Build {
            failure: Box::new(build_failure()),
        },
        &style,
        &redactor,
        Path::new("/repo"),
    );
    for (command, text) in [("serve", serve), ("build", build), ("publish", publish)] {
        assert_eq!(text.lines().count(), 3, "{command}: {text}");
        assert_eq!(
            text.lines().last(),
            Some(
                "  If this base needs lifecycle scripts, enable `review.baseInstallScripts` or use `--base-install-scripts`."
            ),
            "{command}: {text}"
        );
        assert_eq!(
            text.matches("If this base needs lifecycle scripts").count(),
            1
        );
        assert!(!text.contains("Fix the reported comparison input and retry."));
    }
}

#[test]
fn rich_changes_status_keeps_the_failure_reason_without_the_scripts_recovery() {
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 240,
    };
    let reason = serve_errors::changes_reason(
        &ServerError::Comparison {
            source: Box::new(base_failure()),
        },
        Mode::Rich,
    );
    assert_eq!(
        reason,
        "base aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: render failed"
    );
    assert_eq!(
        serve_output::changes_unavailable(&style, &reason, &Redactor::default()),
        "  ! Changes unavailable · base aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: render failed\n"
    );
}
