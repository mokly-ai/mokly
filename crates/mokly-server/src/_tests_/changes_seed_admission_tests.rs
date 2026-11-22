//! Terminal commit results and generation fences govern optional seed admission.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeCancellation, ChangeCancellationMock, ChangeSourceMock};
use crate::changes_background::ChangesPass;
use crate::comparison_support::snapshot;
use crate::error::ServerError;
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::snapshot::Snapshot;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Case {
    Complete,
    RejectCommit,
    Canceled,
    Replaced,
    CanceledAfterCompletion,
}

#[derive(Clone)]
struct Observation {
    case: Case,
    publications: Arc<SharedPublication>,
    replacement: Arc<Snapshot>,
    canceled: Arc<AtomicBool>,
    inside: Arc<AtomicBool>,
    events: Arc<Mutex<Vec<(&'static str, bool)>>>,
}

#[tokio::test]
async fn only_committed_current_uncanceled_completion_admits_seed_outside_commit() {
    let observation = Arc::new(Mutex::new(None::<Observation>));
    let classified = observation.clone();
    let finished = observation.clone();
    let seeded = observation.clone();
    let source_owner = Unimock::new((
        ChangeSourceMock::classify
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                let observed = classified.lock().unwrap().clone().unwrap();
                if observed.case == Case::Canceled {
                    observed.canceled.store(true, Ordering::SeqCst);
                }
                if observed.case == Case::Replaced {
                    let revision = observed.publications.current().index.revision + 1;
                    assert!(
                        observed
                            .publications
                            .replace(observed.replacement.at_revision(revision))
                    );
                }
                Err(ServerError::ChangesUnavailable)
            })),
        ChangeSourceMock::finished
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                let observed = finished.lock().unwrap().clone().unwrap();
                observed
                    .events
                    .lock()
                    .unwrap()
                    .push(("finished", observed.inside.load(Ordering::SeqCst)));
                if observed.case == Case::CanceledAfterCompletion {
                    observed.canceled.store(true, Ordering::SeqCst);
                }
            })),
        ChangeSourceMock::settled
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                let observed = seeded.lock().unwrap().clone().unwrap();
                observed
                    .events
                    .lock()
                    .unwrap()
                    .push(("seed", observed.inside.load(Ordering::SeqCst)));
            })),
    ));
    for case in [
        Case::Complete,
        Case::RejectCommit,
        Case::Canceled,
        Case::Replaced,
        Case::CanceledAfterCompletion,
    ] {
        let origin = snapshot(None);
        let publications = Arc::new(SharedPublication::new(origin.clone()));
        let canceled = Arc::new(AtomicBool::new(false));
        let inside = Arc::new(AtomicBool::new(false));
        let calls = Arc::new(AtomicUsize::new(0));
        let stopping = canceled.clone();
        let committing = inside.clone();
        let counted = calls.clone();
        let token = Unimock::new((
            ChangeCancellationMock::cancelled
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| stopping.load(Ordering::SeqCst))),
            ChangeCancellationMock::commit
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, action| {
                    let index = counted.fetch_add(1, Ordering::SeqCst);
                    if case == Case::RejectCommit && index == 2 {
                        return false;
                    }
                    committing.store(true, Ordering::SeqCst);
                    let committed = action.apply();
                    committing.store(false, Ordering::SeqCst);
                    committed
                })),
        ));
        let cancel: Arc<dyn ChangeCancellation> = Arc::new(token.clone());
        let events = Arc::new(Mutex::new(Vec::new()));
        *observation.lock().unwrap() = Some(Observation {
            case,
            publications: publications.clone(),
            replacement: snapshot(None),
            canceled,
            inside,
            events: events.clone(),
        });
        let pass = ChangesPass {
            publications,
            comparisons: Arc::new(Unimock::new(())),
            diagnostics: Arc::new(Unimock::new(())),
            activity: None,
            watching: false,
        };
        let source = Arc::new(source_owner.clone());
        let committed = pass
            .execute(
                origin.clone(),
                source.clone(),
                cancel.clone(),
                Ok("refs".into()),
            )
            .await;
        let expected_commit = matches!(case, Case::Complete | Case::CanceledAfterCompletion);
        assert_eq!(committed, expected_commit, "{case:?}");
        let (_stop, stop) = watch::channel(false);
        if committed {
            pass.seed_after_completion(origin, source, cancel, stop)
                .await;
        }
        let expected = match case {
            Case::Complete => vec![("finished", true), ("seed", false)],
            Case::CanceledAfterCompletion => vec![("finished", true)],
            _ => vec![],
        };
        assert_eq!(*events.lock().unwrap(), expected, "{case:?}");
    }
}
