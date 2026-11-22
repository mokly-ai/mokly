//! Requested documents lead a rebuilt pass, with catalogue-ordered reports and publication.

use std::sync::{Arc, Mutex};

use axum::http::{Method, StatusCode};
use mokly_catalogue::diagnostic::Warning;
use mokly_model::namespace::generated;
use tokio::sync::watch;
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::backend::DocumentsMock;
use crate::background::UsagePass;
use crate::background_batch::Window;
use crate::background_capacity::FixedCapacity;
use crate::background_read::BackgroundRead;
use crate::delivery_support::{application, request, router};
use crate::publication::{PublicationWriter, Publications, SharedPublication};
use crate::publication_support::{ready, snapshot_with_screens};
use crate::work::{Work, WorkMock, Workers};

use super::support::{route, warning};

#[derive(Default)]
struct Trace {
    lookups: Vec<String>,
    warnings: Vec<String>,
    published: Vec<String>,
}

async fn rebuild_and_run(
    numbers: &[usize],
    publications: Arc<SharedPublication>,
) -> Arc<Mutex<Trace>> {
    let trace = Arc::new(Mutex::new(Trace::default()));
    let documents = Unimock::new((
        DocumentsMock::background_read
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let trace = trace.clone();
                move |_, path| {
                    trace.lock().unwrap().lookups.push(path.into());
                    Ok(Some(BackgroundRead::Complete(vec![warning(path)])))
                }
            })),
        DocumentsMock::report
            .each_call(matching!(_, false))
            .answers_arc(Arc::new({
                let trace = trace.clone();
                move |_, warnings: &[Warning], _| {
                    trace
                        .lock()
                        .unwrap()
                        .warnings
                        .extend(warnings.iter().map(|warning| warning.message.clone()));
                }
            })),
        DocumentsMock::usage
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let trace = trace.clone();
                move |_, path| {
                    trace.lock().unwrap().published.push(path.into());
                    Some(ready())
                }
            })),
    ));
    let revision = publications.current().index.revision + 1;
    let origin =
        snapshot_with_screens(numbers.iter().copied(), Arc::new(documents)).at_revision(revision);
    assert!(publications.replace(origin.clone()));
    let mut updates = publications.subscribe().updates;
    let (_stop, mut stopping) = watch::channel(false);
    let work = Arc::new(Workers::new(1, Arc::new(Unimock::new(()))));
    let pass = UsagePass {
        capacity: Arc::new(FixedCapacity(1)),
        changes: None,
        publications: publications.clone(),
        work: work.clone(),
        diagnostics: Arc::new(Unimock::new(())),
    };
    assert!(pass.fill(&origin, &mut stopping, &mut updates).await);
    work.stop().await;
    let current = publications.current();
    assert_eq!(current.index.revision, revision + 1);
    assert_eq!(current.completed.len(), numbers.len());
    trace
}

#[tokio::test]
async fn recent_document_requests_start_first_and_publish_in_catalogue_order() {
    let old = snapshot_with_screens(
        [0, 2, 3, 4, 6],
        Arc::new(
            Unimock::new(DocumentsMock::usage.each_call(matching!(_)).returns(None))
                .no_verify_in_drop(),
        ),
    );
    let publications = Arc::new(SharedPublication::new(old));
    let mut app = application(publications.clone());
    app.work = Arc::new(Unimock::new((
        WorkMock::generated
            .each_call(
                matching!((_, path) if [2, 3, 4].into_iter().any(|number| path == &route(number))),
            )
            .answers(&|_, _, _| {
                Ok(Some(File {
                    bytes: "<p>requested</p>".into(),
                    content_type: "text/html; charset=utf-8".into(),
                }))
            })
            .n_times(4),
        WorkMock::generated
            .some_call(matching!((_, path) if path == &route(1)))
            .returns(Ok(None)),
    )));
    let router = router(app);
    for (method, number, status) in [
        (Method::GET, 3, StatusCode::OK),
        (Method::HEAD, 2, StatusCode::OK),
        (Method::GET, 4, StatusCode::OK),
        (Method::GET, 3, StatusCode::OK),
        (Method::GET, 1, StatusCode::NOT_FOUND),
    ] {
        let path = format!("/{}", generated(&route(number)));
        assert_eq!(request(&router, method, &path, &[]).await.status(), status);
    }

    let rebuilt = [0, 1, 2, 3, 6, 7];
    let trace = rebuild_and_run(&rebuilt, publications.clone()).await;
    let catalogue: Vec<_> = rebuilt.into_iter().map(route).collect();
    let requested: Vec<_> = [3, 2, 0, 1, 6, 7].into_iter().map(route).collect();
    {
        let trace = trace.lock().unwrap();
        assert_eq!(trace.lookups, requested);
        assert_eq!(trace.published, catalogue);
        assert_eq!(
            trace.warnings,
            catalogue
                .iter()
                .map(|route| warning(route).message)
                .collect::<Vec<_>>()
        );
    }

    let next = rebuild_and_run(&rebuilt, publications).await;
    assert_eq!(next.lock().unwrap().lookups, catalogue);
}

#[tokio::test]
async fn a_warning_waits_for_an_earlier_catalogue_route_that_has_not_started() {
    let mut window = Window::new(1, 2);
    window.start(1, Box::pin(async { Ok(vec![warning(&route(1))]) }));
    let (position, result) = window.next().await;
    let released = window.settle(position, result);
    assert!(
        released.is_empty(),
        "the warning at position 1 must wait for position 0"
    );
    window.start(0, Box::pin(async { Ok(vec![warning(&route(0))]) }));
    let (position, result) = window.next().await;
    let warnings: Vec<_> = window
        .settle(position, result)
        .into_iter()
        .flat_map(|outcome| outcome.unwrap())
        .map(|warning| warning.message)
        .collect();
    assert_eq!(
        warnings,
        [warning(&route(0)).message, warning(&route(1)).message]
    );
}
