//! Strict warning counts wait for base preparation; internal results remain failures.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::CatalogueBuilderMock;
use mokly_compare::base_render::{BasePreparationError, ChangesServiceMock};
use mokly_compare::error::Error;
use mokly_model::read_contract::ContractViolation;
use mokly_model::readers::ReadError;
use mokly_server::error::ServerError;
use unimock::{MockFn, Unimock, matching};

use crate::build::{BuildChanges, BuildError, BuildService, CatalogueBuild};
use crate::cancellation::BuildCancellation;
use crate::changes_diagnostics;
use crate::codes::Code;
use crate::serve_errors::changes_reason;

use super::build_tests::{capture_head, config, graphs, options, prepared};

const HINT: &str = "If this base needs lifecycle scripts, enable `review.baseInstallScripts` or use `--base-install-scripts`.";

#[test]
fn strict_reports_head_and_base_preparation_warnings_after_classification() {
    let head = Warning {
        code: "html-unused-props",
        subject: WarningSubject::Entry("home".into()),
        message: "unused".into(),
    };
    let preparation = Warning {
        code: "base-dependencies",
        subject: WarningSubject::Entry("base".into()),
        message: "fallback".into(),
    };
    let (graphs, _guards) = graphs(vec![head.clone()]);
    let service: &dyn BuildService = &CatalogueBuild {
        inputs: None,
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        config: Arc::new(Unimock::new(
            ConfigLoaderMock::load
                .next_call(matching!(_, _))
                .returns(Ok(config())),
        )),
        catalogue: Arc::new(Unimock::new(
            CatalogueBuilderMock::prepare
                .next_call(matching!(_, _))
                .returns(Ok(prepared(vec![head.clone()]))),
        )),
        graphs,
        changes: Arc::new(Unimock::new((
            capture_head(),
            ChangesServiceMock::classify
                .next_call(matching!(_, _, _, _))
                .returns(Err(Error::Base {
                    commit: "a".repeat(40),
                    scripts_off: false,
                    source: Box::new(Error::Catalogue {
                        source: CatalogueError::Invalid {
                            issues: Vec::new(),
                            warnings: vec![preparation.clone()],
                        },
                    }),
                })),
        ))),
    };
    let mut options = options();
    options.no_changes = false;
    options.strict = true;
    let error = service.run(Path::new("/repo"), &options).unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-cli/build] 1 build warning(s) with --strict"
    );
    let BuildError::Strict { warnings } = error else {
        panic!()
    };
    assert_eq!(warnings.len(), 2);
    assert!(warnings.contains(&head));
    assert!(warnings.contains(&preparation));
}

#[test]
fn failed_base_install_diagnostic_names_the_scripts_opt_in() {
    let error = Error::Base {
        commit: "a".repeat(40),
        scripts_off: true,
        source: Box::new(Error::Graph {
            source: mokly_graph::error::GraphError::Invalid {
                route: "base/index.html".into(),
                message: "render failed".into(),
                code: mokly_html::diagnostic_code::Code::BuildInvalid,
            },
        }),
    };
    let message = changes_diagnostics::failure_detail(&error);
    assert!(message.contains("review.baseInstallScripts"));
    assert!(message.contains("--base-install-scripts"));
    let expected = format!("base {}: render failed. {HINT}", "a".repeat(40));
    assert_eq!(message, expected);
}

#[test]
fn capture_failure_with_scripts_off_base_keeps_the_hint_in_each_detail_path() {
    let error = Error::Base {
        commit: "a".repeat(40),
        scripts_off: true,
        source: Box::new(Error::Graph {
            source: mokly_graph::error::GraphError::Invalid {
                route: "base/index.html".into(),
                message: "render failed.".into(),
                code: mokly_html::diagnostic_code::Code::BuildInvalid,
            },
        }),
    };
    let detail = changes_diagnostics::failure_detail(&error);
    assert!(detail.contains(&format!("base {}", "a".repeat(40))));
    assert!(detail.ends_with("--base-install-scripts`."));
    assert!(!detail.contains(".."));
    let expected = format!("base {}: render failed. {HINT}", "a".repeat(40));
    assert_eq!(detail, expected);
    let Some(BuildChanges::Unavailable {
        base_ref,
        base_commit,
        diagnostics,
        ..
    }) = changes_diagnostics::unavailable(&error, "fixture-base")
    else {
        panic!("render failure must make Changes unavailable");
    };
    assert_eq!(base_ref, "fixture-base");
    assert_eq!(base_commit, "a".repeat(40));
    assert!(matches!(
        changes_diagnostics::failure_code(&error),
        Code::ReviewInvalid
    ));
    assert!(
        diagnostics
            .iter()
            .any(|diagnostic| { diagnostic.message.ends_with("--base-install-scripts`.") })
    );
    let serve_reason = changes_reason(&ServerError::Comparison {
        source: Box::new(error),
    });
    assert!(serve_reason.ends_with("--base-install-scripts`."));
}

#[test]
fn preparation_error_prefix_does_not_change_cli_details() {
    let prepared = BasePreparationError::new(false, Error::Cancelled);
    let error = Error::Base {
        commit: "a".repeat(40),
        scripts_off: prepared.scripts_off,
        source: prepared.source,
    };
    let expected = format!("base {}: build cancelled", "a".repeat(40));
    assert_eq!(changes_diagnostics::failure_detail(&error), expected);
    let serve = ServerError::Comparison {
        source: Box::new(error),
    };
    assert_eq!(changes_reason(&serve), expected);
}

#[test]
fn scripts_off_base_validation_adds_a_separate_opt_in_diagnostic() {
    for scripts_off in [false, true] {
        let source = Error::Graph {
            source: mokly_graph::error::GraphError::Invalid {
                route: "base/index.html".into(),
                message: "render failed".into(),
                code: mokly_html::diagnostic_code::Code::BuildInvalid,
            },
        };
        let error = Error::Base {
            commit: "a".repeat(40),
            scripts_off,
            source: Box::new(source),
        };
        let Some(BuildChanges::Unavailable { diagnostics, .. }) =
            changes_diagnostics::unavailable(&error, "fixture-base")
        else {
            panic!("invalid base must make Changes unavailable");
        };
        assert_eq!(diagnostics.len(), if scripts_off { 2 } else { 1 });
        assert!(matches!(diagnostics[0].code, Code::BuildInvalid));
        assert_eq!(diagnostics[0].message, "render failed");
        if scripts_off {
            assert!(matches!(diagnostics[1].code, Code::BuildInvalid));
            assert_eq!(
                diagnostics[1].message,
                "If this base needs lifecycle scripts, enable `review.baseInstallScripts` or use `--base-install-scripts`."
            );
        }
    }
}

#[test]
fn an_invalid_internal_review_is_a_fatal_build_error() {
    let (graphs, _guards) = graphs(Vec::new());
    let service: &dyn BuildService = &CatalogueBuild {
        inputs: None,
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        config: Arc::new(Unimock::new(
            ConfigLoaderMock::load
                .next_call(matching!(_, _))
                .returns(Ok(config())),
        )),
        catalogue: Arc::new(Unimock::new(
            CatalogueBuilderMock::prepare
                .next_call(matching!(_, _))
                .returns(Ok(prepared(Vec::new()))),
        )),
        graphs,
        changes: Arc::new(Unimock::new((
            capture_head(),
            ChangesServiceMock::classify
                .next_call(matching!(_, _, _, _))
                .returns(Err(Error::Review {
                    source: ReadError::Contract {
                        boundary: "review",
                        message: ContractViolation::Review,
                    },
                })),
        ))),
    };
    let mut options = options();
    options.no_changes = false;
    let BuildError::Comparison {
        base_ref, source, ..
    } = service.run(Path::new("/repo"), &options).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(base_ref, "origin/main");
    assert!(matches!(
        changes_diagnostics::failure_code(&source),
        Code::ReviewInvalid
    ));
}

#[test]
fn source_limits_are_unavailable_and_name_the_limit_and_requested_path() {
    for source in [
        mokly_git::error::Error::FileCount { limit: 3 },
        mokly_git::error::Error::ByteLimit { limit: 64 },
        mokly_git::error::Error::NodeCount { limit: 7 },
        mokly_git::error::Error::OutputLimit { limit: 128 },
    ] {
        let error = Error::Base {
            commit: "a".repeat(40),
            scripts_off: false,
            source: Box::new(Error::SourceFailure {
                source: Arc::new(Error::Limit {
                    path: "specs/large.html".into(),
                    source,
                }),
            }),
        };
        let Some(BuildChanges::Unavailable {
            reason,
            diagnostics,
            ..
        }) = changes_diagnostics::unavailable(&error, "fixture-base")
        else {
            panic!("limit must be unavailable")
        };
        assert_eq!(reason, "comparison limit reached");
        assert!(diagnostics[0].message.starts_with("specs/large.html: "));
        assert!(
            diagnostics[0].message.contains("3")
                || diagnostics[0].message.contains("64")
                || diagnostics[0].message.contains("7")
                || diagnostics[0].message.contains("128")
        );
    }
}

#[test]
fn scripts_off_limit_diagnostic_keeps_the_opt_in_hint() {
    let error = Error::Base {
        commit: "a".repeat(40),
        scripts_off: true,
        source: Box::new(Error::Limit {
            path: "specs/large.html".into(),
            source: mokly_git::error::Error::ByteLimit { limit: 64 },
        }),
    };
    let Some(BuildChanges::Unavailable { diagnostics, .. }) =
        changes_diagnostics::unavailable(&error, "fixture-base")
    else {
        panic!("limit must be unavailable");
    };
    assert_eq!(diagnostics.len(), 2);
    assert!(diagnostics[0].message.contains("specs/large.html"));
    assert!(diagnostics[1].message.contains("review.baseInstallScripts"));
    assert!(diagnostics[1].message.contains("--base-install-scripts"));
}
