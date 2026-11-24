//! A moved probe transfers one uninterrupted lease through refresh and execution.

use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::{mpsc::unbounded_channel, oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::changes::ChangeSourceMock;
use crate::comparison_store::ComparisonsMock;
use crate::error::ServerError;
use crate::publication::Publications;

use super::support::{Counts, Release, activity, setup};

#[tokio::test(start_paused = true)]
async fn moved_reference_keeps_activity_through_refresh_and_classification_then_releases_when_idle()
{
    let counts = Arc::new(Counts::default());
    let activity = activity(counts.clone());
    let (discarded, mut discarding) = unbounded_channel();
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let probe_counts = counts.clone();
    let refreshed = Arc::new(Mutex::new(None));
    let refresh_observed = refreshed.clone();
    let refresh_counts = counts.clone();
    let (classified, classifying) = oneshot::channel();
    let classified = Mutex::new(Some(classified));
    let (finish, finishing) = mpsc::channel();
    let finishing = Mutex::new(finishing);
    let classify_counts = counts.clone();
    let source = Unimock::new((
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Err(ServerError::ChangesUnavailable)),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .returns(()),
        ChangeSourceMock::discarded
            .next_call(matching!())
            .answers_arc(Arc::new({
                let discarded = discarded.clone();
                move |_| discarded.send(()).unwrap()
            })),
        ChangeSourceMock::references
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                entered
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(probe_counts.state())
                    .unwrap();
                released.lock().unwrap().recv().unwrap();
                Err(ServerError::ChangesUnavailable)
            })),
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Ok("moved".into())),
        ChangeSourceMock::refreshed
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| {
                *refresh_observed.lock().unwrap() = Some(refresh_counts.state());
                None
            })),
        ChangeSourceMock::classify
            .next_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| {
                classified
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(classify_counts.state())
                    .unwrap();
                finishing.lock().unwrap().recv().unwrap();
                Err(ServerError::ChangesUnavailable)
            })),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .returns(()),
        ChangeSourceMock::discarded
            .next_call(matching!())
            .answers_arc(Arc::new(move |_| discarded.send(()).unwrap())),
    ));
    let collected = Arc::new(Mutex::new(Vec::new()));
    let collect_observed = collected.clone();
    let collect_counts = counts.clone();
    let comparisons = Unimock::new(ComparisonsMock::collect.each_call(matching!()).answers_arc(
        Arc::new(move |_| {
            collect_observed
                .lock()
                .unwrap()
                .push(collect_counts.state());
        }),
    ));
    let (pass, origin, publications) = setup(
        Arc::new(source.clone()),
        Arc::new(activity.clone()),
        Arc::new(comparisons.clone()),
    );
    let release = Release(release);
    let finish = Release(finish);
    let (stop, stopping) = watch::channel(false);
    let run = tokio::spawn(async move { pass.run(origin, stopping).await });
    discarding.recv().await.unwrap();
    let initial = counts.state();
    tokio::time::advance(Duration::from_secs(1)).await;
    let probing = entering.await.unwrap();
    let terminal = publications.current().index.changes_status;
    release.0.send(()).unwrap();
    tokio::time::advance(Duration::from_secs(1)).await;
    let classifying = classifying.await.unwrap();
    let pending = publications.current().index.changes_status;
    finish.0.send(()).unwrap();
    discarding.recv().await.unwrap();
    stop.send_replace(true);
    run.await.unwrap();
    assert_eq!(
        *refreshed.lock().unwrap(),
        Some((1, 2)),
        "moved refs must keep the probe lease through source refresh"
    );
    assert_eq!(
        classifying,
        (1, 2),
        "the refreshed classification must retain the same uninterrupted lease"
    );
    assert_eq!(initial, (0, 1));
    assert_eq!(probing, (1, 1));
    assert_eq!(terminal, ChangesStatus::Unavailable);
    assert_eq!(pending, ChangesStatus::Pending);
    assert_eq!(*collected.lock().unwrap(), [(0, 1), (0, 2)]);
    assert_eq!(counts.state(), (0, 3));
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Unavailable
    );
}
