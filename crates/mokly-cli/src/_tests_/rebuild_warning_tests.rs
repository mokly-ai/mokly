//! Failed rechecks retain pending records and error records through a successful repair.

use std::sync::Arc;
use std::time::Duration;

use mokly_cli::grammar::Common;
use mokly_server::error::ServerError;
use mokly_server::publication::{PublicationWriterMock, PublicationsMock};
use mokly_server::shutdown::FixedLifecycle;
use mokly_watch::event::Batch;
use unimock::{MockFn, Unimock, matching};

use crate::serve_candidates::ManualCandidates;
use crate::serve_rebuild::{ManualRebuilds, RebuildReporter, RebuildReporterMock};
use crate::serve_state::ServeStateFactoryMock;
use crate::serve_watch::{CandidateWatch, WatchInputsMock};
use crate::warning_support::{Scripted, catalogue, invalid, plan, scopes, warning};

use super::serve_rebuild_tests::initial;

#[test]
fn failed_catalogue_combines_pending_and_error_warnings_and_repair_reports_only_new_records() {
    let script = Scripted::new(vec![
        Ok(catalogue(vec![warning("z")])),
        Err(invalid(vec![warning("a"), warning("a")])),
        Ok(catalogue(vec![
            warning("a"),
            warning("pending"),
            warning("z"),
            warning("new"),
        ])),
    ]);
    let terminal = Unimock::new(());
    let scopes = scopes(&terminal);
    let observer = Unimock::new(());
    let origin = initial();
    let mock = Unimock::new((
        WatchInputsMock::candidate.next_call(matching!(_)).returns(Ok(CandidateWatch {
            plan: plan(), observer: Arc::new(observer.clone()), recheck: true,
        })),
        WatchInputsMock::failed.next_call(matching!()).returns(()),
        WatchInputsMock::plan.next_call(matching!()).returns(plan()),
        RebuildReporterMock::watched_catalogue_failure.next_call(matching!((_, _, records, _) if *records == [warning("a"), warning("pending"), warning("z")])).returns(()),
        WatchInputsMock::candidate.next_call(matching!(_)).returns(Ok(CandidateWatch {
            plan: plan(), observer: Arc::new(observer.clone()), recheck: false,
        })),
        PublicationsMock::current.next_call(matching!()).returns(origin.clone()),
        ServeStateFactoryMock::replace.next_call(matching!(_, 2, _, _)).returns(Ok(origin.at_revision(2))),
        PublicationWriterMock::replace.next_call(matching!(_)).returns(true),
        WatchInputsMock::adopt.next_call(matching!(_, _)).returns(()),
        RebuildReporterMock::completed.next_call(matching!((summary, _) if summary.warnings == [warning("new")])).returns(()),
    ));
    let action = ManualRebuilds {
        warnings: scopes.clone(),
        watching: Some(Arc::new(mock.clone())),
        candidates: Arc::new(ManualCandidates::new(Arc::new(FixedLifecycle))),
        preparation: script.preparation.clone(),
        states: Arc::new(mock.clone()),
        publications: Arc::new(mock.clone()),
        writer: Arc::new(mock.clone()),
        reporter: Arc::new(mock.clone()),
        cwd: "/repo".into(),
        options: Common::default(),
    };
    let failed = scopes.begin();
    failed.report(&[warning("pending")], false);
    assert!(action.rebuild(&Batch::default(), failed).is_none());
    let repair = scopes.begin();
    let summary = action.rebuild(&Batch::default(), repair.clone()).unwrap();
    repair.finish(&summary.warnings, false, &|records| {
        let mut summary = summary.clone();
        summary.warnings = records.to_vec();
        mock.completed(&summary, Duration::ZERO);
    });
}

#[test]
fn a_retired_failed_candidate_still_sets_the_watch_retry_flag() {
    let script = Scripted::new(vec![Err(invalid(vec![warning("ignored")]))]);
    let terminal = Unimock::new(());
    let scopes = scopes(&terminal);
    let watch = Unimock::new(WatchInputsMock::failed.next_call(matching!()).returns(()));
    let action = ManualRebuilds {
        warnings: scopes.clone(),
        watching: Some(Arc::new(watch.clone())),
        candidates: Arc::new(ManualCandidates::new(Arc::new(FixedLifecycle))),
        preparation: script.preparation.clone(),
        states: Arc::new(watch.clone()),
        publications: Arc::new(watch.clone()),
        writer: Arc::new(watch.clone()),
        reporter: Arc::new(watch.clone()),
        cwd: "/repo".into(),
        options: Common::default(),
    };
    let retired = scopes.begin();
    let _replacement = scopes.begin();
    assert!(action.rebuild(&Batch::default(), retired).is_none());
}

#[test]
fn watched_recheck_keeps_first_pass_warnings_only_when_its_recheck_fails() {
    for fails in [false, true] {
        let script = Scripted::new(vec![
            Ok(catalogue(vec![warning("first")])),
            Ok(catalogue(vec![warning("final")])),
        ]);
        let terminal = Unimock::new(());
        let scopes = scopes(&terminal);
        let observer = Unimock::new(());
        let candidate = WatchInputsMock::candidate
            .next_call(matching!(_))
            .returns(Ok(CandidateWatch {
                plan: plan(),
                observer: Arc::new(observer.clone()),
                recheck: true,
            }));
        let origin = initial();
        let mock = if fails {
            Unimock::new((candidate,
                WatchInputsMock::recheck.next_call(matching!(_, _)).returns(Err(ServerError::InvalidAssets)),
                WatchInputsMock::failed.next_call(matching!()).returns(()),
                WatchInputsMock::plan.next_call(matching!()).returns(plan()),
                RebuildReporterMock::watched_server_failure.next_call(matching!((_, _, records, _) if *records == [warning("final"), warning("first")])).returns(()),
            ))
        } else {
            Unimock::new((
                candidate,
                WatchInputsMock::recheck
                    .next_call(matching!(_, _))
                    .returns(Ok(())),
                PublicationsMock::current
                    .next_call(matching!())
                    .returns(origin.clone()),
                ServeStateFactoryMock::replace
                    .next_call(matching!(_, 2, _, _))
                    .returns(Ok(origin.at_revision(2))),
                PublicationWriterMock::replace
                    .next_call(matching!(_))
                    .returns(true),
                WatchInputsMock::adopt
                    .next_call(matching!(_, _))
                    .returns(()),
            ))
        };
        let action = ManualRebuilds {
            warnings: scopes.clone(),
            watching: Some(Arc::new(mock.clone())),
            candidates: Arc::new(ManualCandidates::new(Arc::new(FixedLifecycle))),
            preparation: script.preparation.clone(),
            states: Arc::new(mock.clone()),
            publications: Arc::new(mock.clone()),
            writer: Arc::new(mock.clone()),
            reporter: Arc::new(mock.clone()),
            cwd: "/repo".into(),
            options: Common::default(),
        };
        let attempt = scopes.begin();
        let result = action.rebuild(&Batch::default(), attempt.clone());
        assert_eq!(result.is_none(), fails);
        if let Some(summary) = result {
            attempt.finish(&summary.warnings, false, &|records| {
                assert_eq!(records, [warning("final")])
            });
        }
    }
}
