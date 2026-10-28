//! Strict mode counts every warning except `base-dependencies`, which still prints.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::preparation::CatalogueBuilderMock;
use mokly_compare::base_render::ChangesServiceMock;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::review::ReviewResultV8;
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use unimock::{MockFn, Unimock, matching};

use crate::build::{BuildChanges, BuildError, BuildService, BuildSummary, CatalogueBuild};
use crate::build_output::failure;
use crate::cancellation::BuildCancellation;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;

use super::build_tests::{capture_head, config, graphs, options, prepared};

fn configuration_warning(code: &'static str, message: &str) -> Warning {
    Warning {
        code,
        subject: WarningSubject::Configuration("mokly.config.json".into()),
        message: message.into(),
    }
}

/// A completed comparison that retains these base preparation warnings.
fn ready(warnings: Vec<Warning>) -> ComparisonResult {
    ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        validation_lookups: 0,
        warnings,
        review: ReviewResultV8 {
            schema_version: 8,
            base_commit: "a".repeat(40),
            entries: vec![],
            affected: vec![],
            diagnostics: vec![],
        },
        snapshot: CatalogueChangeSnapshotV4 {
            schema_version: 4,
            base_ref: "base".into(),
            base_commit: "a".repeat(40),
            changed_entries: vec![],
            moved_entries: vec![],
            removed_entries: vec![],
        },
        entries: vec![],
        pairing: Default::default(),
        counts: Default::default(),
        before: Arc::new(Unimock::new(())),
        after: Arc::new(Unimock::new(())),
    }
}

/// Run a strict build whose head render and comparison raise these warnings.
fn strict_build(head: Vec<Warning>, base: Vec<Warning>) -> Result<BuildSummary, BuildError> {
    let (graphs, _guards) = graphs(head.clone());
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
                .returns(Ok(prepared(head))),
        )),
        graphs,
        changes: Arc::new(Unimock::new((
            capture_head(),
            ChangesServiceMock::classify
                .next_call(matching!(_, _, _, _))
                .answers_arc(Arc::new(move |_, _, _, _, _| Ok(ready(base.clone())))),
        ))),
    };
    let mut options = options();
    options.no_changes = false;
    options.strict = true;
    service.run(Path::new("/repo"), &options)
}

#[test]
fn a_strict_build_whose_only_warnings_are_base_dependencies_succeeds_and_keeps_them() {
    let notice = configuration_warning(
        "base-dependencies",
        "Base dependencies differ. HTML comparison uses working-tree dependencies.",
    );
    let summary = strict_build(Vec::new(), vec![notice.clone()]).unwrap();
    assert_eq!(summary.warnings, [notice]);
    assert!(matches!(summary.changes, BuildChanges::Ready(_)));
}

#[test]
fn a_strict_failure_prints_every_warning_and_counts_all_but_base_dependencies() {
    let head = Warning {
        code: "html-unused-props",
        subject: WarningSubject::Entry("home".into()),
        message: "prop \"label\" is not read by the body".into(),
    };
    let base = vec![
        configuration_warning(
            "base-dependencies",
            "base dependencies could not be installed (installation failed); using working-tree dependencies",
        ),
        configuration_warning("base-conversion", "resource \"bad.png\" is unavailable"),
    ];
    let error = strict_build(vec![head], base).unwrap_err();
    assert_eq!(
        error.to_string(),
        "[mokly-cli/build] 2 build warning(s) with --strict"
    );
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 200,
    };
    let text = failure(&style, &error, &Redactor::default(), Path::new("/repo"));
    assert_eq!(text.matches("[mokly/warning]").count(), 3, "{text}");
    assert!(
        text.ends_with("[mokly/build-invalid] 2 build warnings with --strict\n"),
        "{text}"
    );
}
