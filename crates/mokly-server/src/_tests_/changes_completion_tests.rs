//! Completion callbacks see committed metadata and exclude replaced work.

use std::sync::{Arc, Mutex};

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSource, ChangeSourceMock};
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::changes_support::fixture;
use crate::comparison_store::ComparisonsMock;
use crate::comparison_support::snapshot;
use crate::error::ServerError;
use crate::publication::{Publications, SharedPublication};

#[derive(Clone, Copy, Debug)]
enum Outcome {
    Ready,
    Unavailable,
    Replaced,
}

#[tokio::test(start_paused = true)]
async fn completion_follows_committed_ready_or_unavailable_and_excludes_replacement() {
    for outcome in [Outcome::Ready, Outcome::Unavailable, Outcome::Replaced] {
        let (origin, result, _graph) = match outcome {
            Outcome::Ready => {
                let (origin, result, graph) = fixture();
                (origin, Some(result), Some(graph))
            }
            Outcome::Unavailable | Outcome::Replaced => (snapshot(None), None, None),
        };
        let source;
        let store;
        {
            let publications = Arc::new(SharedPublication::new(origin.clone()));
            let (stop, stopping) = watch::channel(false);
            let observed = Arc::new(Mutex::new(Vec::new()));
            let statuses = observed.clone();
            let settled = observed.clone();
            let complete_stop = stop.clone();
            let published = Arc::downgrade(&publications);
            let completed = published.clone();
            let common = (
                ChangeSourceMock::references
                    .some_call(matching!(_))
                    .returns(Ok("refs".into())),
                ChangeSourceMock::classify
                    .some_call(matching!(_, _, _))
                    .returns(match outcome {
                        Outcome::Ready => Ok(result.unwrap()),
                        Outcome::Unavailable => Err(ServerError::ChangesUnavailable),
                        Outcome::Replaced => Err(ServerError::ChangesReplaced),
                    }),
                ChangeSourceMock::discarded
                    .some_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        if matches!(outcome, Outcome::Replaced) {
                            stop.send_replace(true);
                        }
                    })),
            );
            source =
                match outcome {
                    Outcome::Replaced => Unimock::new(common),
                    Outcome::Ready | Outcome::Unavailable => Unimock::new((
                        common,
                        ChangeSourceMock::finished
                            .some_call(matching!(_, _))
                            .answers_arc(Arc::new(move |_, _, _| {
                                statuses.lock().unwrap().push(
                                    published.upgrade().unwrap().current().index.changes_status,
                                );
                            })),
                        ChangeSourceMock::settled
                            .some_call(matching!())
                            .answers_arc(Arc::new(move |_| {
                                settled.lock().unwrap().push(
                                    completed.upgrade().unwrap().current().index.changes_status,
                                );
                                complete_stop.send_replace(true);
                            })),
                    )),
                };
            let mut origin = (*origin).clone();
            let input: Arc<dyn ChangeSource> = Arc::new(source.clone());
            Arc::make_mut(&mut origin.generation).changes = Some(input);
            store = match outcome {
                Outcome::Ready => Unimock::new((
                    ComparisonsMock::check_capacity
                        .each_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(()))
                        .n_times(1),
                    ComparisonsMock::install
                        .each_call(matching!(_, _))
                        .answers(&|_, _, _| Ok(()))
                        .n_times(1),
                )),
                Outcome::Unavailable | Outcome::Replaced => Unimock::new(()),
            };
            let pass: Arc<dyn AfterUsage> = Arc::new(ChangesPass {
                publications: publications.clone(),
                comparisons: Arc::new(store.clone()),
                diagnostics: Arc::new(Unimock::new(())),
                activity: None,
                watching: false,
            });
            pass.run(Arc::new(origin), stopping).await;
            let expected = match outcome {
                Outcome::Ready => vec![ChangesStatus::Ready, ChangesStatus::Ready],
                Outcome::Unavailable => {
                    vec![ChangesStatus::Unavailable, ChangesStatus::Unavailable]
                }
                Outcome::Replaced => vec![],
            };
            assert_eq!(*observed.lock().unwrap(), expected, "{outcome:?}");
        }
    }
}
