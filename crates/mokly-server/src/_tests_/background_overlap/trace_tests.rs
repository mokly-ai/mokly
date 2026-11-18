//! Blocking startup preparation and capture retain their separate diagnostic parent.

use std::sync::{Arc, Mutex};

use mokly_test_support::capture::Trace;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background::{Background, UsagePass};
use crate::changes::ChangeSourceMock;
use crate::changes_trace_support::in_runtime;
use crate::publication::SharedPublication;
use crate::publication_support::{ready, snapshot};
use crate::startup_preparation::StartupPreparationMock;
use crate::work::WorkMock;

#[test]
fn blocking_preparation_and_capture_have_the_startup_parent() {
    let traces = Trace::default();
    in_runtime(&traces, async {
        let (finished, finishing) = oneshot::channel();
        let finished = Arc::new(Mutex::new(Some(finished)));
        let source = Unimock::new(
            ChangeSourceMock::startup
                .some_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, cancel, usage| {
                    let finished = finished.clone();
                    Some(Arc::new(Unimock::new((
                        StartupPreparationMock::prepare
                            .some_call(matching!())
                            .answers_arc(Arc::new(move |_| {
                                {
                                    let _scope =
                                        tracing::info_span!("review.test-prepare").entered();
                                }
                                let settled = usage.wait(cancel.as_ref());
                                {
                                    let _scope =
                                        tracing::info_span!("review.test-capture").entered();
                                }
                                settled
                            })),
                        StartupPreparationMock::finished
                            .some_call(matching!())
                            .answers_arc(Arc::new(move |_| {
                                finished.lock().unwrap().take().unwrap().send(()).unwrap();
                            })),
                    ))))
                })),
        );
        let mut origin = (*snapshot(
            1,
            Arc::new(Unimock::new(
                DocumentsMock::usage
                    .each_call(matching!(_))
                    .returns(Some(ready())),
            )),
        ))
        .clone();
        Arc::make_mut(&mut origin.generation).changes = Some(Arc::new(source));
        let publications = Arc::new(SharedPublication::new(Arc::new(origin)));
        let pass = UsagePass {
            batch: 1,
            changes: None,
            publications,
            work: Arc::new(Unimock::new(
                WorkMock::background
                    .some_call(matching!(_, _))
                    .returns(Ok(Vec::new())),
            )),
            diagnostics: Arc::new(Unimock::new(())),
        };
        let (stop, stopping) = watch::channel(false);
        let task = tokio::spawn(async move { pass.run(stopping).await });
        finishing.await.unwrap();
        stop.send_replace(true);
        task.await.unwrap();
    });
    for child in ["review.test-prepare", "review.test-capture"] {
        let spans = traces.closed(child);
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].parent_name, Some("review.startup-base"));
    }
    let startup = traces.closed("review.startup-base");
    assert_eq!(startup.len(), 1);
    assert_eq!(
        startup[0].fields.get("status").map(String::as_str),
        Some("ok")
    );
    assert!(traces.closed("changes.classify").is_empty());
}
