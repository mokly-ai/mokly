//! Strict warning counts wait for base preparation; internal results remain failures.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::CatalogueBuilderMock;
use mokly_compare::base_render::ChangesServiceMock;
use mokly_compare::error::Error;
use mokly_model::read_contract::ContractViolation;
use mokly_model::readers::ReadError;
use unimock::{MockFn, Unimock, matching};

use crate::build::{BuildChanges, BuildError, BuildService, CatalogueBuild};
use crate::cancellation::BuildCancellation;
use crate::changes_diagnostics;
use crate::codes::Code;

use super::build_tests::{config, graphs, options, prepared};

#[test]
fn strict_counts_head_and_base_preparation_warnings_after_classification() {
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
        changes: Arc::new(Unimock::new(
            ChangesServiceMock::classify
                .next_call(matching!(_, _, _))
                .returns(Err(Error::Base {
                    commit: "a".repeat(40),
                    source: Box::new(Error::Catalogue {
                        source: CatalogueError::Invalid {
                            issues: Vec::new(),
                            warnings: vec![preparation.clone()],
                        },
                    }),
                })),
        )),
    };
    let mut options = options();
    options.no_changes = false;
    options.strict = true;
    let BuildError::Strict { warnings } = service.run(Path::new("/repo"), &options).unwrap_err()
    else {
        panic!()
    };
    assert_eq!(warnings.len(), 2);
    assert!(warnings.contains(&head));
    assert!(warnings.contains(&preparation));
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
        changes: Arc::new(Unimock::new(
            ChangesServiceMock::classify
                .next_call(matching!(_, _, _))
                .returns(Err(Error::Review {
                    source: ReadError::Contract {
                        boundary: "review",
                        message: ContractViolation::Review,
                    },
                })),
        )),
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
        }) = changes_diagnostics::unavailable(&error)
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
