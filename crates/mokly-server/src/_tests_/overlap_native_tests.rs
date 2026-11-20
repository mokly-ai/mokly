//! Superseded handoffs and native calls keep their distinct blocking-job owners.
//! Runtime teardown joins blocking captures before original mocks verify.

use std::collections::BTreeMap;
use std::future::Future;
use std::sync::{Arc, Condvar, Mutex};
use std::task::{Context, Waker};

use mokly_graph::cache::Artifact;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGenerationMock};
use mokly_model::axes::ColorScheme;
use tokio::runtime::Builder;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DocumentsMock, GraphDocuments};
use crate::background_capacity::FixedCapacity;
use crate::background_stage::Stages;
use crate::work::{Work, Workers};

type Gate = Arc<(Mutex<bool>, Condvar)>;

fn wait(gate: &Gate) {
    let mut open = gate.0.lock().unwrap();
    while !*open {
        open = gate.1.wait(open).unwrap();
    }
}

fn release(gate: &Gate) {
    *gate.0.lock().unwrap() = true;
    gate.1.notify_all();
}

struct Cleanup(Vec<Gate>);
impl Drop for Cleanup {
    fn drop(&mut self) {
        for gate in &self.0 {
            release(gate);
        }
    }
}

#[test]
fn superseded_handoff_and_native_job_keep_owners_until_stop_drains() {
    let old_gate = Arc::new((Mutex::new(false), Condvar::new()));
    let native_gate = Arc::new((Mutex::new(false), Condvar::new()));
    let (old_sent, old_started) = oneshot::channel();
    let old_sent = Mutex::new(Some(old_sent));
    let old = Unimock::new(
        DocumentsMock::background_staged
            .some_call(matching!("old", _))
            .answers_arc(Arc::new({
                let old_gate = old_gate.clone();
                move |_, _, completion| {
                    completion.handoff(128);
                    old_sent.lock().unwrap().take().unwrap().send(()).unwrap();
                    wait(&old_gate);
                    Ok(Vec::new())
                }
            })),
    );
    let route = "native/index.html";
    let (native_sent, native_started) = oneshot::channel();
    let native_sent = Mutex::new(Some(native_sent));
    let generation = Unimock::new((
        RenderGenerationMock::plans
            .some_call(matching!())
            .returns(BTreeMap::from([(
                route.into(),
                DocumentPlan {
                    route: route.into(),
                    key: NodeKey("native".into()),
                    resource_key: "native".into(),
                    entry: 0,
                    viewport: None,
                    color_scheme: ColorScheme::Light,
                    stylesheets: vec![],
                },
            )])),
        RenderGenerationMock::render
            .some_call(matching!("native/index.html"))
            .answers_arc(Arc::new({
                let native_gate = native_gate.clone();
                move |_, _| {
                    native_sent
                        .lock()
                        .unwrap()
                        .take()
                        .unwrap()
                        .send(())
                        .unwrap();
                    wait(&native_gate);
                    Ok(Arc::new(Artifact {
                        bytes: vec![],
                        content_type: "text/html".into(),
                        document: None,
                        fragment: None,
                    }))
                }
            })),
    ));
    let dependencies = Unimock::new(());
    let native = GraphDocuments::new(
        Arc::new(generation.clone()),
        Arc::new(dependencies.clone()),
        Arc::new(dependencies.clone()),
        Arc::new(dependencies.clone()),
    );
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let stages = Stages::new(Arc::new(FixedCapacity(2)));
    let old_stage = stages.view("old");
    let runtime = Builder::new_current_thread().enable_all().build().unwrap();
    let _cleanup = Cleanup(vec![old_gate.clone(), native_gate.clone()]);
    runtime.block_on(async {
        let old_job = tokio::spawn({
            let work = work.clone();
            let stage = old_stage.clone();
            let documents = Arc::new(old.clone());
            async move { work.background_staged(documents, "old".into(), stage).await }
        });
        old_started.await.unwrap();
        old_job.abort();
        assert!(old_job.await.unwrap_err().is_cancelled());
        let native_stage = stages.view(route);
        let native_job = tokio::spawn({
            let work = work.clone();
            let stage = native_stage.clone();
            async move {
                work.background_staged(Arc::new(native), route.into(), stage)
                    .await
            }
        });
        native_started.await.unwrap();
        assert!(old_stage.handed_off());
        assert_eq!(*stages.active.lock().unwrap(), 1);
        assert_eq!(*stages.bytes.lock().unwrap(), 128);
        assert!(!native_stage.handed_off());
        assert!(native_stage.state.lock().unwrap().place.is_none());
        assert!(native_stage.state.lock().unwrap().charge.is_none());
        assert_eq!(work.workers.available_permits(), 1);
        assert!(native_stage.state.lock().unwrap().worker.is_some());
        native_job.abort();
        assert!(native_job.await.unwrap_err().is_cancelled());
        assert_eq!(work.workers.available_permits(), 1);
        let mut stopping = Box::pin(work.stop());
        assert!(
            stopping
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop()))
                .is_pending()
        );
        release(&old_gate);
        loop {
            let changed = work.priority.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            if *stages.active.lock().unwrap() == 0 && *stages.bytes.lock().unwrap() == 0 {
                break;
            }
            changed.await;
        }
        assert!(
            stopping
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop()))
                .is_pending()
        );
        assert!(native_stage.state.lock().unwrap().worker.is_some());
        release(&native_gate);
        stopping.await;
        assert_eq!(work.workers.available_permits(), 2);
        assert_eq!(*stages.active.lock().unwrap(), 0);
        assert_eq!(*stages.bytes.lock().unwrap(), 0);
        assert!(native_stage.state.lock().unwrap().worker.is_none());
    });
}
