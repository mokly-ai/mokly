//! Initial and replacement Changes requests follow their completed usage passes.

use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::{mpsc::unbounded_channel, watch};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, DocumentsMock};
use crate::background::{Background, UsagePass};
use crate::changes_background::AfterUsageMock;
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::publication_support::{ready, snapshot};
use crate::work::{Work, Workers};

#[tokio::test]
async fn changes_starts_only_after_each_initial_and_replacement_usage_pass_finishes() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let (render_started, mut rendering) = unbounded_channel();
    let mut releases = Vec::new();
    let mut documents: Vec<Arc<dyn Documents>> = Vec::new();
    for (start, finished) in [
        ("usage-first", "usage-finished-first"),
        ("usage-edit", "usage-finished-edit"),
    ] {
        let (release, released) = mpsc::channel();
        releases.push(release);
        let released = Mutex::new(released);
        let rendered = events.clone();
        let render_started = render_started.clone();
        documents.push(Arc::new(Unimock::new((
            DocumentsMock::usage
                .each_call(matching!(_))
                .returns(Some(ready())),
            DocumentsMock::background
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    rendered.lock().unwrap().push(start);
                    render_started.send(start).unwrap();
                    released.lock().unwrap().recv().unwrap();
                    rendered.lock().unwrap().push(finished);
                    Ok(Vec::new())
                })),
        ))));
    }
    let first = snapshot(1, documents[0].clone());
    let edit = snapshot(1, documents[1].clone());
    let publications = Arc::new(SharedPublication::new(first));
    let completed = Arc::new(Mutex::new(Vec::new()));
    let completed_at_changes = completed.clone();
    let current = publications.clone();
    let (changes_started, mut comparing) = unbounded_channel();
    let started = events.clone();
    let changes = Unimock::new(
        AfterUsageMock::run
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, origin, _| {
                let position = documents
                    .iter()
                    .position(|document| Arc::ptr_eq(document, &origin.documents))
                    .unwrap();
                started
                    .lock()
                    .unwrap()
                    .push(["changes-first", "changes-edit"][position]);
                completed_at_changes
                    .lock()
                    .unwrap()
                    .push(current.current().completed.len());
                changes_started.send(position).unwrap();
            }))
            .n_times(2),
    );
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let pass = UsagePass {
        batch: 1,
        changes: Some(Arc::new(changes)),
        publications: publications.clone(),
        work: work.clone(),
        diagnostics: Arc::new(Unimock::new(())),
    };
    let (stop, stopping) = watch::channel(false);
    let task = tokio::spawn(async move { pass.run(stopping).await });
    assert_eq!(rendering.recv().await, Some("usage-first"));
    let before_first = events.lock().unwrap().clone();
    releases[0].send(()).unwrap();
    assert_eq!(comparing.recv().await, Some(0));
    assert!(publications.replace(edit.at_revision(publications.current().index.revision + 1)));
    assert_eq!(rendering.recv().await, Some("usage-edit"));
    let before_edit = events.lock().unwrap().clone();
    releases[1].send(()).unwrap();
    assert_eq!(comparing.recv().await, Some(1));
    stop.send_replace(true);
    task.await.unwrap();
    work.stop().await;
    assert_eq!(before_first, ["usage-first"]);
    assert_eq!(
        before_edit,
        [
            "usage-first",
            "usage-finished-first",
            "changes-first",
            "usage-edit"
        ]
    );
    assert_eq!(
        *events.lock().unwrap(),
        [
            "usage-first",
            "usage-finished-first",
            "changes-first",
            "usage-edit",
            "usage-finished-edit",
            "changes-edit"
        ]
    );
    assert_eq!(*completed.lock().unwrap(), [1, 1]);
}
