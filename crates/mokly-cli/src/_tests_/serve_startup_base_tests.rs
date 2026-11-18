//! A keyed current outcome and its diagnostics can cross the handoff only once.

use std::sync::Arc;

use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::base_selection::PinnedBase;
use mokly_compare::base_startup::PreparedOutcome;
use mokly_compare::error::Error;
use mokly_git::identity::ObjectId;
use mokly_graph::types::RenderGeneration;
use mokly_server::changes::ChangeToken;
use unimock::Unimock;

use crate::serve_base_key::BaseKey;
use crate::serve_startup_base::{StartupHandoff, StartupReady, StartupState};
use crate::warning_support::{config, warning};

pub(super) fn key(commit: char, head: &dyn RenderGeneration) -> BaseKey {
    BaseKey::new(&BaseRetentionRequest {
        selected: &PinnedBase {
            reference: "main".into(),
            commit: ObjectId::parse(&commit.to_string().repeat(40)).unwrap(),
            repository: Arc::new(Unimock::new(())),
        },
        working_config: &config(),
        head,
        install_scripts: false,
    })
    .unwrap()
}

#[test]
fn a_current_keyed_outcome_transfers_warnings_and_cache_line_once() {
    let state: &dyn StartupHandoff = &StartupState::default();
    let head: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
    let cancel = Arc::new(ChangeToken::default());
    let began = state.begin(head.clone(), cancel.clone());
    let selected = key('a', head.as_ref());
    state.selected(selected.clone());
    state.complete(StartupReady {
        result: Ok(PreparedOutcome::Retained),
        warnings: vec![warning("uses current dependencies")],
        cache: Some("/cache/base".into()),
        lifetime: None,
    });
    state.finished();
    let ready = state.take(&selected, &head, cancel.as_ref()).unwrap();
    let replay = state.take(&selected, &head, cancel.as_ref()).unwrap();
    assert!(began);
    let ready = ready.unwrap();
    assert!(matches!(ready.result, Ok(PreparedOutcome::Retained)));
    assert_eq!(ready.warnings.len(), 1);
    assert_eq!(
        ready.cache.as_deref(),
        Some(std::path::Path::new("/cache/base"))
    );
    assert!(replay.is_none());
    let untaken = StartupState::default();
    let worker = head.clone();
    let supervisor = head.clone();
    assert!(untaken.begin(head.clone(), Arc::new(ChangeToken::default())));
    untaken.selected(selected);
    untaken.complete(ready);
    untaken.finished();
    let origin = Arc::downgrade(&head);
    drop(worker);
    drop(supervisor);
    drop(head);
    assert!(
        origin.upgrade().is_none(),
        "a drained startup handoff must release its origin before ordinary classification"
    );
}

#[test]
fn a_current_keyed_failure_transfers_the_original_type_once() {
    let state: &dyn StartupHandoff = &StartupState::default();
    let head: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
    let cancel = Arc::new(ChangeToken::default());
    state.begin(head.clone(), cancel.clone());
    let selected = key('a', head.as_ref());
    state.selected(selected.clone());
    state.complete(StartupReady {
        result: Err(Error::Base {
            commit: "a".repeat(40),
            scripts_off: true,
            source: Box::new(Error::UnsupportedManager),
        }),
        warnings: Vec::new(),
        cache: None,
        lifetime: None,
    });
    state.finished();
    let ready = state.take(&selected, &head, cancel.as_ref()).unwrap();
    let replay = state.take(&selected, &head, cancel.as_ref()).unwrap();
    assert!(
        matches!(ready.map(|ready| ready.result), Some(Err(Error::Base { scripts_off: true, source, .. })) if matches!(*source, Error::UnsupportedManager))
    );
    assert!(replay.is_none());
}
