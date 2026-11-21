//! Preparation starts before usage and its origin explicitly drains it on stop.

use std::sync::{Arc, Mutex, mpsc};

use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::background::{Background, UsagePass};
use crate::background_capacity::FixedCapacity;
use crate::changes_background::{AfterUsageMock, PendingChanges, PendingChangesMock};
use crate::publication::{Publications, PublicationsMock, SharedPublication};
use crate::publication_support;
use crate::work::WorkMock;

#[tokio::test]
async fn eager_usage_starts_before_dispatch_and_stop_joins_it() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let owner = events.clone();
    let pending: Arc<dyn PendingChanges> = Arc::new(
        Unimock::new((
            PendingChangesMock::dispatched
                .each_call(matching!())
                .returns(()),
            PendingChangesMock::cancel_and_join
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| owner.lock().unwrap().push("joined"))),
        ))
        .no_verify_in_drop(),
    );
    let owner = events.clone();
    let changes = Unimock::new(AfterUsageMock::prepare.some_call(matching!(_)).answers_arc(
        Arc::new(move |_, _| {
            owner.lock().unwrap().push("prepared");
            Some(pending.clone())
        }),
    ))
    .no_verify_in_drop();
    let origin = publication_support::snapshot(1, Arc::new(Unimock::new(())));
    let publications = Arc::new(SharedPublication::new(origin));
    let (stop, stopping) = watch::channel(false);
    let owner = events.clone();
    let work = Unimock::new(
        WorkMock::background
            .some_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| {
                owner.lock().unwrap().push("usage");
                stop.send_replace(true);
                Ok(Vec::new())
            })),
    );
    let pass = UsagePass {
        capacity: Arc::new(FixedCapacity(2)),
        changes: Some(Arc::new(changes)),
        publications,
        work: Arc::new(work),
        diagnostics: Arc::new(Unimock::new(())),
    };
    pass.run(stopping).await;
    assert_eq!(*events.lock().unwrap(), ["prepared", "usage", "joined"]);
}

#[tokio::test]
async fn eager_dispatch_and_classification_wait_for_their_usage_boundaries() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let owner = events.clone();
    let joining = events.clone();
    let pending: Arc<dyn PendingChanges> = Arc::new(
        Unimock::new((
            PendingChangesMock::dispatched
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| owner.lock().unwrap().push("dispatched"))),
            PendingChangesMock::cancel_and_join
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| joining.lock().unwrap().push("joined"))),
        ))
        .no_verify_in_drop(),
    );
    let (stop, stopping) = watch::channel(false);
    let owner = events.clone();
    let classifying = events.clone();
    let changes = Unimock::new((
        AfterUsageMock::prepare
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                owner.lock().unwrap().push("prepared");
                Some(pending.clone())
            })),
        AfterUsageMock::run
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                classifying.lock().unwrap().push("classified");
                stop.send_replace(true);
            })),
    ))
    .no_verify_in_drop();
    let origin = publication_support::snapshot(3, Arc::new(Unimock::new(())));
    let routes: Vec<_> = origin
        .routes
        .iter()
        .map(|route| route.route.clone())
        .collect();
    let owner = events.clone();
    let publications = Unimock::new((
        PublicationsMock::current
            .each_call(matching!())
            .returns(origin),
        PublicationsMock::subscribe
            .some_call(matching!())
            .answers(&|_| {
                SharedPublication::new(publication_support::snapshot(0, Arc::new(Unimock::new(()))))
                    .subscribe()
            }),
        PublicationsMock::completed_many
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                owner.lock().unwrap().push("completed");
                Ok(())
            })),
    ));
    let owner = events.clone();
    let dispatch_at_render = Arc::new(Mutex::new(Vec::new()));
    let rendered = dispatch_at_render.clone();
    let pass = UsagePass {
        capacity: Arc::new(FixedCapacity(2)),
        changes: Some(Arc::new(changes)),
        publications: Arc::new(publications),
        work: Arc::new(Unimock::new((
            WorkMock::parallelism.each_call(matching!()).returns(1usize),
            WorkMock::background
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, route, _| {
                    let mut events = owner.lock().unwrap();
                    rendered
                        .lock()
                        .unwrap()
                        .push((route.clone(), events.contains(&"dispatched")));
                    events.push("usage");
                    Ok(Vec::new())
                })),
        ))),
        diagnostics: Arc::new(Unimock::new(())),
    };
    pass.run(stopping).await;
    let observed = events.lock().unwrap().clone();
    assert_eq!(observed.first(), Some(&"prepared"));
    assert_eq!(
        &observed[observed.len() - 3..],
        ["completed", "classified", "joined"]
    );
    assert_eq!(
        observed
            .iter()
            .filter(|event| **event == "dispatched")
            .count(),
        1
    );
    let rendered = dispatch_at_render.lock().unwrap();
    assert_eq!(
        rendered
            .iter()
            .map(|(route, _)| route.clone())
            .collect::<Vec<_>>(),
        routes
    );
    assert!(
        rendered[..rendered.len() - 1]
            .iter()
            .all(|(_, dispatched)| !dispatched),
        "only the last route may observe the dispatch signal: {rendered:?}"
    );
}

#[tokio::test]
async fn eager_usage_stop_joins_before_the_origin_owner_returns() {
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let pending: Arc<dyn PendingChanges> = Arc::new(
        Unimock::new((
            PendingChangesMock::dispatched
                .each_call(matching!())
                .returns(()),
            PendingChangesMock::cancel_and_join
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    entered.lock().unwrap().take().unwrap().send(()).unwrap();
                    released.lock().unwrap().recv().unwrap();
                })),
        ))
        .no_verify_in_drop(),
    );
    let changes = Unimock::new(
        AfterUsageMock::prepare
            .some_call(matching!(_))
            .returns(Some(pending)),
    );
    let origin = publication_support::snapshot(1, Arc::new(Unimock::new(())));
    let (stop, stopping) = watch::channel(false);
    let pass = UsagePass {
        capacity: Arc::new(FixedCapacity(2)),
        changes: Some(Arc::new(changes)),
        publications: Arc::new(SharedPublication::new(origin)),
        work: Arc::new(Unimock::new(
            WorkMock::background
                .some_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, _, _, _| {
                    stop.send_replace(true);
                    Ok(Vec::new())
                })),
        )),
        diagnostics: Arc::new(Unimock::new(())),
    };
    let mut run = tokio::spawn(async move { pass.run(stopping).await });
    let entered = tokio::select! {
        entered = entering => entered.is_ok(),
        finished = &mut run => { finished.unwrap(); false },
    };
    let waited = entered && !run.is_finished();
    let released = release.send(());
    if entered {
        run.await.unwrap();
    }
    assert!(entered, "the origin must call its explicit pending drain");
    assert!(
        waited,
        "the origin cannot return while its pending drain is blocked"
    );
    released.unwrap();
}
