//! Only the first head can schedule an independent base-only preparation.

use std::sync::{Arc, Mutex};

use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::backend::Documents;
use crate::background::{Background, UsagePass};
use crate::changes::ChangeSourceMock;
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::publication_support::snapshot;
use crate::startup_preparation::StartupPreparationMock;
use crate::work::WorkMock;

#[tokio::test]
async fn first_head_preparation_has_one_separate_joined_owner() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let prepared = events.clone();
    let finished = events.clone();
    let task = Unimock::new((
        StartupPreparationMock::prepare
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                prepared.lock().unwrap().push("prepare");
                true
            })),
        StartupPreparationMock::finished
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                finished.lock().unwrap().push("finish");
            })),
    ))
    .no_verify_in_drop();
    let scheduled = events.clone();
    let source = Unimock::new(
        ChangeSourceMock::startup
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                scheduled.lock().unwrap().push("schedule");
                Some(Arc::new(task.clone()))
            })),
    )
    .no_verify_in_drop();
    let mut head = (*snapshot(1, Arc::new(Unimock::new(())))).clone();
    Arc::make_mut(&mut head.generation).changes = Some(Arc::new(source));
    let publications = Arc::new(SharedPublication::new(Arc::new(head)));
    let (stop, stopping) = watch::channel(false);
    let usage = events.clone();
    let work = Unimock::new(
        WorkMock::background
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                usage.lock().unwrap().push("usage");
                stop.send_replace(true);
                Ok(Vec::new())
            })),
    );
    let pass = UsagePass {
        batch: 1,
        changes: None,
        publications: publications.clone(),
        work: Arc::new(work),
        diagnostics: Arc::new(Unimock::new(())),
    };
    pass.run(stopping).await;
    let events = events.lock().unwrap().clone();
    assert_eq!(events.first(), Some(&"schedule"));
    assert_eq!(
        events.iter().filter(|event| **event == "prepare").count(),
        1
    );
    assert_eq!(events.iter().filter(|event| **event == "finish").count(), 1);
    assert_eq!(publications.current().completed.len(), 0);
}

#[tokio::test]
async fn an_unused_first_head_opportunity_does_not_move_to_a_later_head() {
    let hooks = Arc::new(Mutex::new(Vec::new()));
    let source = |name| {
        let hooks = hooks.clone();
        Arc::new(
            Unimock::new(
                ChangeSourceMock::startup
                    .each_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, _, _| {
                        hooks.lock().unwrap().push(name);
                        None
                    })),
            )
            .no_verify_in_drop(),
        )
    };
    let (publications, first_documents) = {
        let documents: Arc<dyn Documents> = Arc::new(Unimock::new(()));
        let first_documents = Arc::downgrade(&documents);
        let mut first = (*snapshot(1, documents)).clone();
        Arc::make_mut(&mut first.generation).changes = Some(source("HTML first"));
        (
            Arc::new(SharedPublication::new(Arc::new(first))),
            first_documents,
        )
    };
    let mut next = (*snapshot(1, Arc::new(Unimock::new(())))).clone();
    Arc::make_mut(&mut next.generation).changes = Some(source("sidecar later"));
    let next = Arc::new(next);
    let replacement = publications.clone();
    let (stop, stopping) = watch::channel(false);
    let retained = Arc::new(Mutex::new(Vec::new()));
    let during_replacement = retained.clone();
    let work = Unimock::new(
        WorkMock::background
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, documents, _| {
                if first_documents.ptr_eq(&Arc::downgrade(&documents)) {
                    let _ = replacement
                        .replace(next.at_revision(replacement.current().index.revision + 1));
                } else {
                    during_replacement
                        .lock()
                        .unwrap()
                        .push(first_documents.upgrade().is_some());
                    stop.send_replace(true);
                }
                Ok(Vec::new())
            }))
            .n_times(2),
    );
    UsagePass {
        batch: 1,
        changes: None,
        publications,
        work: Arc::new(work),
        diagnostics: Arc::new(Unimock::new(())),
    }
    .run(stopping)
    .await;
    assert_eq!(*hooks.lock().unwrap(), ["HTML first"]);
    assert_eq!(
        *retained.lock().unwrap(),
        [false],
        "the first HTML Documents owner must be released during replacement usage"
    );
}
