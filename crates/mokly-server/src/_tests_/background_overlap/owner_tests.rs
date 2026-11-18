//! New head usage proceeds while one old classification drains; only the newest waits.

use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::mpsc::unbounded_channel;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, DocumentsMock};
use crate::background::{Background, UsagePass};
use crate::changes::{ChangeSource, ChangeSourceMock};
use crate::changes_background::ChangesPass;
use crate::error::ServerError;
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::publication_support::{ready, snapshot};
use crate::snapshot::Snapshot;
use crate::work::WorkMock;

fn origin(documents: Arc<dyn Documents>, source: Arc<dyn ChangeSource>) -> Arc<Snapshot> {
    let mut origin = (*snapshot(1, documents)).clone();
    Arc::make_mut(&mut origin.generation).changes = Some(source);
    Arc::new(origin)
}

async fn completed(publications: &dyn Publications) {
    let mut updates = publications.subscribe().updates;
    while publications.current().completed.len() != 1 {
        updates.recv().await.unwrap();
    }
}

#[tokio::test]
async fn rapid_head_replacements_run_usage_while_only_the_newest_preparation_waits() {
    let documents: Vec<Arc<dyn Documents>> = (0..3)
        .map(|_| {
            let documents: Arc<dyn Documents> = Arc::new(
                Unimock::new(
                    DocumentsMock::usage
                        .each_call(matching!(_))
                        .returns(Some(ready())),
                )
                .no_verify_in_drop(),
            );
            documents
        })
        .collect();
    let events = Arc::new(Mutex::new(Vec::new()));
    let first_events = events.clone();
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let first = Unimock::new((
        ChangeSourceMock::references
            .some_call(matching!(_))
            .returns(Ok("base".into())),
        ChangeSourceMock::classify
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, cancel, _| {
                first_events.lock().unwrap().push("first");
                entered
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(cancel)
                    .unwrap();
                released.lock().unwrap().recv().unwrap();
                Err(ServerError::ChangesUnavailable)
            })),
    ));
    let (stop, stopping) = watch::channel(false);
    let last_events = events.clone();
    let last = Unimock::new((
        ChangeSourceMock::references
            .some_call(matching!(_))
            .returns(Ok("base".into())),
        ChangeSourceMock::classify
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                last_events.lock().unwrap().push("last");
                Err(ServerError::ChangesUnavailable)
            })),
        ChangeSourceMock::finished
            .some_call(matching!(Err(ServerError::ChangesUnavailable), _))
            .answers_arc(Arc::new(move |_, _, _| {
                stop.send_replace(true);
            })),
    ));
    let first_source = first.clone();
    let last_source = last.clone();
    let first = origin(documents[0].clone(), Arc::new(first_source));
    let middle = origin(documents[1].clone(), Arc::new(Unimock::new(())));
    let last = origin(documents[2].clone(), Arc::new(last_source));
    let publications = Arc::new(SharedPublication::new(first));
    let (usage, mut rendered) = unbounded_channel();
    let work = Unimock::new(
        WorkMock::background
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, input, _| {
                let generation = documents
                    .iter()
                    .position(|known| Arc::ptr_eq(known, &input))
                    .unwrap();
                usage.send(generation).unwrap();
                Ok(Vec::new())
            }))
            .n_times(3),
    );
    let pass = UsagePass {
        batch: 1,
        changes: Some(Arc::new(ChangesPass {
            publications: publications.clone(),
            comparisons: Arc::new(Unimock::new(())),
            diagnostics: Arc::new(Unimock::new(())),
            watching: false,
        })),
        publications: publications.clone(),
        work: Arc::new(work),
        diagnostics: Arc::new(Unimock::new(())),
    };
    let task = tokio::spawn(async move { pass.run(stopping).await });
    let cancelled = entering.await.unwrap();
    let first_usage = rendered.recv().await.unwrap();
    completed(publications.as_ref()).await;
    assert!(publications.replace(middle.at_revision(publications.current().index.revision + 1)));
    let middle_usage = rendered.recv().await.unwrap();
    completed(publications.as_ref()).await;
    assert!(publications.replace(last.at_revision(publications.current().index.revision + 1)));
    let last_usage = rendered.recv().await.unwrap();
    let before_drain = events.lock().unwrap().clone();
    release.send(()).unwrap();
    task.await.unwrap();
    assert_eq!([first_usage, middle_usage, last_usage], [0, 1, 2]);
    assert_eq!(before_drain, ["first"]);
    assert_eq!(*events.lock().unwrap(), ["first", "last"]);
    assert!(cancelled.cancelled());
}
