//! Adoption proves current dependency inputs and shares compatible reads.

use std::sync::{Arc, Mutex};

use mokly_compare::base_freshness::{DependencySelection, FreshnessChecks, FreshnessMock};
use mokly_compare::inputs::Inputs;
use mokly_compare::working_inputs::WorkingInputsMock;
use mokly_git::identity::RepoPath;
use mokly_server::changes::ChangeToken;
use unimock::{MockFn, Unimock, matching};

use crate::serve_base_key::BaseKey;
use crate::serve_eager::PendingBase;
use crate::serve_eager_evidence::{AdoptionEvidence, HeadEvidence, NativeEvidence};
use crate::serve_eager_task::PreparationTaskMock;

use self::support::{Fixture, Read, checkout, dependency_inputs};
use super::NativePending;

#[path = "eager_evidence_support.rs"]
mod support;

#[test]
fn eager_adoption_rejects_same_key_stale_working_or_head_dependency_inputs() {
    let fixture = Fixture::new();
    let request = fixture.request();
    let mut changed = Inputs::default();
    changed.files.insert(
        RepoPath::parse("package.json").unwrap(),
        b"changed".to_vec(),
    );
    let mut observed = Vec::new();
    for (working_changed, directories) in [
        (true, Vec::new()),
        (false, vec!["node_modules".into()]),
        (false, Vec::new()),
    ] {
        let current = if working_changed {
            changed.clone()
        } else {
            Inputs::default()
        };
        let evidence: &dyn AdoptionEvidence = &NativeEvidence {
            key: BaseKey::new(&request).unwrap(),
            working: Arc::new(
                Unimock::new(
                    WorkingInputsMock::read
                        .some_call(matching!(_, _, _))
                        .returns(Ok(current)),
                )
                .no_verify_in_drop(),
            ),
            inputs: Some(Inputs::default()),
            checkout: Some(checkout()),
            head: Mutex::new(Some(HeadEvidence {
                directories: Vec::new(),
                unmapped: Vec::new(),
                catalogue: Vec::new(),
            })),
        };
        observed.push(
            evidence
                .current(&request, &directories, &[])
                .unwrap()
                .is_some(),
        );
    }
    assert_eq!(observed, [false, false, true]);
}

#[test]
fn adoption_rejects_a_checkout_change_during_the_working_input_scan() {
    let fixture = Fixture::with_checkout_change(true);
    let freshness = Arc::new(FreshnessChecks {
        working: fixture.working.clone(),
        installs: Arc::new(Unimock::new(())),
    });
    let work = fixture.work(
        DependencySelection {
            inputs: dependency_inputs(),
            ..DependencySelection::default()
        },
        freshness,
    );

    let adopted = work.take_prepared(&fixture.request()).unwrap();
    assert!(
        adopted.is_none(),
        "adopted a preparation with obsolete checkout settings"
    );
}

#[test]
fn ended_eager_adoption_checks_evidence_once() {
    for (ended, expected) in [
        (true, vec![Read::Working, Read::Checkout]),
        (
            false,
            vec![Read::Working, Read::Checkout, Read::Working, Read::Checkout],
        ),
    ] {
        let fixture = Fixture::new();
        let freshness = Arc::new(Unimock::new(
            FreshnessMock::current
                .some_call(matching!(_, _))
                .returns(Ok(true)),
        ));
        let task = Arc::new(Unimock::new((
            PreparationTaskMock::sources_ready
                .some_call(matching!(_))
                .returns(()),
            PreparationTaskMock::ended
                .some_call(matching!())
                .returns(ended),
            PreparationTaskMock::continue_for_classification
                .some_call(matching!(_))
                .returns(()),
            PreparationTaskMock::join
                .some_call(matching!())
                .returns(Ok(())),
        )));
        let pending: &dyn PendingBase = &NativePending {
            config: fixture.config.clone(),
            task,
            work: Arc::new(fixture.work(DependencySelection::default(), freshness)),
        };
        let adopted = pending
            .adopt(
                &fixture.request(),
                Arc::new(ChangeToken::default()),
                Arc::new(ChangeToken::default()),
            )
            .unwrap()
            .unwrap();
        adopted.sources.unwrap();
        adopted.prepared.unwrap().unwrap();
        assert_eq!(*fixture.reads.lock().unwrap(), expected, "ended={ended}");
    }
}

#[test]
fn take_prepared_shares_current_inputs_and_reads_selected_html_paths() {
    let inputs = dependency_inputs();
    let paths = inputs.files.keys().cloned().collect::<Vec<_>>();
    for (selection, expected) in [
        (
            DependencySelection {
                inputs: inputs.clone(),
                ..DependencySelection::default()
            },
            vec![Read::Working, Read::Checkout],
        ),
        (
            DependencySelection {
                inputs,
                paths: Some(paths.clone()),
                ..DependencySelection::default()
            },
            vec![Read::Working, Read::Checkout, Read::Paths(paths)],
        ),
        (
            DependencySelection::default(),
            vec![Read::Working, Read::Checkout, Read::Working],
        ),
    ] {
        let fixture = Fixture::new();
        let freshness = Arc::new(FreshnessChecks {
            working: fixture.working.clone(),
            installs: Arc::new(Unimock::new(())),
        });
        let work = fixture.work(selection, freshness);
        let adopted = work.take_prepared(&fixture.request()).unwrap().unwrap();
        adopted.prepared.unwrap().unwrap();
        assert_eq!(
            *fixture.reads.lock().unwrap(),
            expected,
            "freshness shares only compatible adoption reads"
        );
    }
}
