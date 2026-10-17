//! Ready Changes follows its warnings before the publication warning gate.

use std::path::Path;
use std::sync::{Arc, Mutex};

use mokly_compare::comparison_types::ComparisonResult;
use mokly_model::review::ReviewResultV8;
use mokly_model::snapshot::CatalogueChangeSnapshotV4;
use unimock::Unimock;

use crate::build::{BuildChanges, BuildError};
use crate::static_build::{Request, StaticBuild};

use super::mocks::mocks;
use super::support::{Case, config, options};

pub(super) fn changes() -> BuildChanges {
    BuildChanges::Ready(Arc::new(ComparisonResult {
        resource_work: Default::default(),
        affected_lookups: 0,
        validation_lookups: 0,
        warnings: vec![],
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
    }))
}

#[test]
fn warnings_precede_ready_changes_and_fatal_warnings_prevent_staging() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let (builder, mut transaction) = mocks(
        Case {
            ready: true,
            warnings: true,
            ..Default::default()
        },
        events.clone(),
    );
    let config = config();
    let mut options = options();
    options.no_changes = false;
    let result = builder.build(
        Request {
            cwd: Path::new("/repo"),
            config: &config,
            options: &options,
            viewer: vec![],
            repository: Path::new("/repo"),
            publication: None,
            warnings_are_fatal: true,
        },
        &mut transaction,
    );
    assert!(matches!(result, Err(BuildError::Warnings)));
    let events = events.lock().unwrap();
    let warnings = events
        .iter()
        .position(|event| *event == "warnings")
        .unwrap();
    assert_eq!(events[warnings + 1], "changes");
    assert!(events.contains(&"abandon"));
    assert!(!events.contains(&"stage") && !events.contains(&"install"));
}
