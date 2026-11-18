//! Changes begins while one current usage render remains behind an explicit fence.

use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::{broadcast, oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::background::{Background, UsagePass};
use crate::changes_background::AfterUsageMock;
use crate::publication::{PublicationEvent, PublicationsMock, Subscription};
use crate::publication_support::snapshot;
use crate::work::{Work, Workers};

#[tokio::test]
async fn changes_starts_before_the_current_usage_pass_finishes() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let (render_started, rendering) = oneshot::channel();
    let render_started = Mutex::new(Some(render_started));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let rendered = events.clone();
    let documents = Unimock::new(
        DocumentsMock::background
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                rendered.lock().unwrap().push("usage-render");
                render_started
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(())
                    .unwrap();
                released.lock().unwrap().recv().unwrap();
                Ok(Vec::new())
            })),
    );
    let origin = snapshot(1, Arc::new(documents));
    let (_updates, receiver) = broadcast::channel(8);
    let (stop, stopping) = watch::channel(false);
    let published = events.clone();
    let publications = Unimock::new((
        PublicationsMock::current
            .each_call(matching!())
            .returns(origin),
        PublicationsMock::subscribe
            .some_call(matching!())
            .returns(Subscription {
                current: PublicationEvent {
                    revision: 1,
                    deployment_id: "process".into(),
                },
                updates: receiver,
            }),
        PublicationsMock::completed_many
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                published.lock().unwrap().push("usage-complete");
                stop.send_replace(true);
                Ok(())
            })),
    ));
    let (changes_started, preparing) = oneshot::channel();
    let changes_started = Mutex::new(Some(changes_started));
    let started = events.clone();
    let changes = Unimock::new(
        AfterUsageMock::run
            .some_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| {
                started.lock().unwrap().push("changes-start");
                changes_started
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(())
                    .unwrap();
            })),
    );
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let pass = UsagePass {
        batch: 1,
        changes: Some(Arc::new(changes)),
        publications: Arc::new(publications),
        work: work.clone(),
        diagnostics: Arc::new(Unimock::new(())),
    };
    let task = tokio::spawn(async move { pass.run(stopping).await });
    rendering.await.unwrap();
    preparing.await.unwrap();
    let before_release = events.lock().unwrap().clone();
    release.send(()).unwrap();
    task.await.unwrap();
    work.stop().await;
    assert_eq!(before_release.len(), 2);
    assert!(before_release.contains(&"changes-start"));
    assert!(before_release.contains(&"usage-render"));
    assert_eq!(events.lock().unwrap().last(), Some(&"usage-complete"));
}
