//! A deferred miss releases lookup ownership while its writer and drain owners survive.

use std::collections::BTreeMap;
use std::future::Future;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::task::{Context, Waker};

use mokly_graph::background::{self, BackgroundMissMock};
use mokly_graph::cache::Artifact;
use mokly_graph::error::GraphError;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGenerationMock};
use mokly_graph::write_activity::{WriteActivityMock, WriteLease};
use mokly_model::axes::ColorScheme;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_model::usage::CatalogueUsage;
use tokio::sync::Notify;
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, GraphDocuments};
use crate::background_capacity::BackgroundCapacityMock;
use crate::background_dispatch::Dispatch;
use crate::background_stage::Stages;
use crate::error::ServerError;
use crate::warnings::TracingWarnings;
use crate::work::{Work, Workers};

struct Lease(Arc<AtomicUsize>);
impl WriteLease for Lease {}
impl Drop for Lease {
    fn drop(&mut self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn queued_miss_releases_worker_and_usage_lock_then_skips_settled_foreground_usage() {
    for failed in [false, true] {
        let resumed = Arc::new(AtomicUsize::new(0));
        let artifact = Arc::new(Artifact {
            bytes: b"foreground".to_vec(),
            document: None,
            fragment: None,
            content_type: "text/html".into(),
        });
        let generation = Unimock::new((
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(BTreeMap::from([(
                    "view".into(),
                    DocumentPlan {
                        key: NodeKey("view".into()),
                        resource_key: "view".into(),
                        route: "view".into(),
                        entry: 0,
                        viewport: None,
                        color_scheme: ColorScheme::Light,
                        stylesheets: vec![],
                    },
                )])),
            RenderGenerationMock::read_background
                .some_call(matching!("view"))
                .answers_arc(Arc::new({
                    let resumed = resumed.clone();
                    let artifact = artifact.clone();
                    move |_, _| {
                        let resumed = resumed.clone();
                        let artifact = artifact.clone();
                        let miss = Unimock::new((
                            BackgroundMissMock::root_eligible
                                .each_call(matching!())
                                .returns(true),
                            BackgroundMissMock::complete
                                .each_call(matching!(_))
                                .answers_arc(Arc::new(move |_, _| {
                                    resumed.fetch_add(1, Ordering::SeqCst);
                                    Ok(artifact.clone())
                                })),
                        ))
                        .no_verify_in_drop();
                        Ok(Some(background::BackgroundRead::Miss(Box::new(miss))))
                    }
                })),
            RenderGenerationMock::render
                .some_call(matching!("view"))
                .answers_arc(Arc::new(move |_, _| {
                    if failed {
                        Err(GraphError::Runtime {
                            source: RuntimeDiagnostic {
                                code: RuntimeCode::Cancelled,
                                message: "foreground failed".into(),
                            },
                        })
                    } else {
                        Ok(artifact.clone())
                    }
                })),
        ));
        let documents = Arc::new(GraphDocuments::new(
            Arc::new(generation),
            Arc::new(Unimock::new(())),
            Arc::new(TracingWarnings),
            Arc::new(Unimock::new(())),
        ));
        let queries = Arc::new(AtomicUsize::new(0));
        let queued = Arc::new(Notify::new());
        let capacity = Unimock::new(
            BackgroundCapacityMock::capacity
                .each_call(matching!())
                .answers_arc(Arc::new({
                    let queries = queries.clone();
                    let queued = queued.clone();
                    move |_| {
                        if queries.fetch_add(1, Ordering::SeqCst) == 1 {
                            queued.notify_one();
                        }
                        1
                    }
                })),
        );
        let stages = Stages::new(Arc::new(capacity));
        let held = stages.batch.acquire().await.unwrap();
        let dispatch = Dispatch::new(stages);
        let entered = Arc::new(AtomicUsize::new(0));
        let released = Arc::new(AtomicUsize::new(0));
        let activity = Unimock::new(WriteActivityMock::enter.each_call(matching!()).answers_arc(
            Arc::new({
                let entered = entered.clone();
                let released = released.clone();
                move |_| {
                    entered.fetch_add(1, Ordering::SeqCst);
                    Box::new(Lease(released.clone())) as Box<dyn WriteLease>
                }
            }),
        ));
        let work = Arc::new(
            Workers::new(1, Arc::new(Unimock::new(()))).with_activity(Some(Arc::new(activity))),
        );
        let task = tokio::spawn({
            let work = work.clone();
            let documents = documents.clone();
            let dispatch = dispatch.clone();
            async move { work.background(documents, "view".into(), dispatch).await }
        });
        queued.notified().await;
        assert_eq!(
            work.workers.available_permits(),
            1,
            "a queued miss releases its lookup worker"
        );
        assert_eq!(*documents.locks["view"].try_lock().unwrap(), None);
        assert_eq!(entered.load(Ordering::SeqCst), 1);
        assert_eq!(released.load(Ordering::SeqCst), 0);
        assert!(
            dispatch.stage.get().is_none(),
            "admission queues metadata without a Stage"
        );
        let mut drain = Box::pin(work.background_jobs.drain());
        assert!(
            drain
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop()))
                .is_pending()
        );
        let foreground = work.generated(documents.clone(), "view".into()).await;
        let outcome = match foreground {
            Ok(Some(file)) => Ok(file.bytes.to_vec()),
            Err(ServerError::Render {
                source: GraphError::Runtime { source },
            }) => Err(source.code),
            _ => panic!("foreground must return its bytes or its recorded failure"),
        };
        assert_eq!(
            outcome,
            if failed {
                Err(RuntimeCode::Cancelled)
            } else {
                Ok(b"foreground".to_vec())
            }
        );
        assert_eq!(documents.usage("view"), Some(CatalogueUsage::Unavailable));
        assert_eq!(entered.load(Ordering::SeqCst), 2);
        assert_eq!(released.load(Ordering::SeqCst), 1);
        assert!(
            drain
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop()))
                .is_pending()
        );
        drop(held);
        assert!(task.await.unwrap().unwrap().is_empty());
        drain.await;
        work.stop().await;
        assert_eq!(
            resumed.load(Ordering::SeqCst),
            0,
            "settled foreground usage skips the captured miss"
        );
        assert_eq!(released.load(Ordering::SeqCst), 2);
    }
}
