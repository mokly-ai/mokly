//! Passes preserve catalogue order and run once for each replacement backend.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::readers;
use tokio::sync::{broadcast, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::Documents;
use crate::background::{Background, UsagePass};
use crate::evidence::RenderRoute;
use crate::publication::{PublicationEvent, PublicationsMock, Subscription};
use crate::revision::RevisionLease;
use crate::snapshot::Snapshot;
use crate::work::WorkMock;

fn snapshot(paths: Vec<String>, documents: Arc<dyn Documents>) -> Arc<Snapshot> {
    Arc::new(Snapshot {
        index: readers::index(include_str!(
            "../../../../docs/protocol/fixtures/catalogue-v7.json"
        ))
        .unwrap(),
        routes: paths
            .into_iter()
            .map(|path| RenderRoute {
                route: format!("{path}/index.mobile.html"),
                path,
                viewport: Some(Viewport::Mobile),
                color_scheme: ColorScheme::Light,
            })
            .collect(),
        documents,
        details: Default::default(),
        completed: Default::default(),
        files: Default::default(),
        entries: Default::default(),
        lease: Arc::new(RevisionLease::default()),
        stub: Vec::new(),
        render_token: "secret".into(),
    })
}

#[tokio::test]
async fn each_catalogue_route_runs_once_in_order_and_a_replacement_restarts_the_pass() {
    for count in [2, 8] {
        let documents = Unimock::new(());
        let first = snapshot(
            (0..count)
                .rev()
                .map(|index| format!("entry-{index}"))
                .collect(),
            Arc::new(documents.clone()),
        );
        let second = snapshot(vec!["replacement".into()], Arc::new(documents.clone()));
        let current = Arc::new(Mutex::new(first.clone()));
        let calls = Arc::new(Mutex::new(Vec::new()));
        let stages = Arc::new(AtomicUsize::new(0));
        let (updates, receiver) = broadcast::channel(64);
        let (stop, stopping) = watch::channel(false);
        let mock = Unimock::new((
            PublicationsMock::current
                .each_call(matching!())
                .answers_arc(Arc::new({
                    let current = current.clone();
                    move |_| current.lock().unwrap().clone()
                })),
            PublicationsMock::subscribe
                .next_call(matching!())
                .returns(Subscription {
                    current: PublicationEvent {
                        revision: 1,
                        deployment_id: "process".into(),
                    },
                    updates: receiver,
                }),
            PublicationsMock::completed_many
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let stages = stages.clone();
                    let current = current.clone();
                    let second = second.clone();
                    move |_, origin, routes| {
                        assert_eq!(
                            routes,
                            origin
                                .routes
                                .iter()
                                .map(|view| view.route.clone())
                                .collect::<Vec<_>>()
                        );
                        if stages.fetch_add(1, Ordering::SeqCst) == 0 {
                            *current.lock().unwrap() = second.clone();
                            assert!(
                                updates
                                    .send(PublicationEvent {
                                        revision: 2,
                                        deployment_id: "process".into()
                                    })
                                    .is_ok()
                            );
                        } else {
                            stop.send_replace(true);
                        }
                        Ok(())
                    }
                })),
            WorkMock::background
                .each_call(matching!(_, _))
                .answers_arc(Arc::new({
                    let calls = calls.clone();
                    move |_, _, route| {
                        calls.lock().unwrap().push(route);
                        Ok(())
                    }
                })),
        ));
        let diagnostics = Unimock::new(());
        let pass = UsagePass {
            publications: Arc::new(mock.clone()),
            work: Arc::new(mock.clone()),
            diagnostics: Arc::new(diagnostics.clone()),
        };
        assert!(calls.lock().unwrap().is_empty());
        pass.run(stopping).await;
        let expected: Vec<_> = first
            .routes
            .iter()
            .chain(&second.routes)
            .map(|view| view.route.clone())
            .collect();
        assert_eq!(*calls.lock().unwrap(), expected);
        assert_eq!(calls.lock().unwrap().len(), count + 1);
        assert_eq!(stages.load(Ordering::SeqCst), 2);
    }
}
