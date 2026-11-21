//! Post-completion work releases write activity and drains on replacement or shutdown.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};

use mokly_graph::write_activity::{WriteActivityMock, WriteLease};
use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::changes::ChangeSourceMock;
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::comparison_support::snapshot;
use crate::error::ServerError;
use crate::publication::{PublicationWriter, Publications, SharedPublication};

struct Activity(Arc<AtomicUsize>);

impl WriteLease for Activity {}

impl Drop for Activity {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

#[tokio::test]
async fn post_completion_releases_write_activity_and_drains_seed_before_owner_returns() {
    for replace in [false, true] {
        let origin = snapshot(None);
        let publications = Arc::new(SharedPublication::new(origin.clone()));
        let activity = Arc::new(AtomicUsize::new(0));
        let admitted = activity.clone();
        let (entered, entering) = oneshot::channel();
        let entered = Mutex::new(Some(entered));
        let (release, released) = mpsc::channel();
        let released = Mutex::new(released);
        let published = Arc::downgrade(&publications);
        let active = activity.clone();
        let source = Unimock::new((
            ChangeSourceMock::references
                .next_call(matching!(_))
                .returns(Ok("refs".into())),
            ChangeSourceMock::classify
                .next_call(matching!(_, _))
                .returns(Err(ServerError::ChangesUnavailable)),
            ChangeSourceMock::finished
                .next_call(matching!(_, _))
                .returns(()),
            ChangeSourceMock::settled
                .next_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    entered
                        .lock()
                        .unwrap()
                        .take()
                        .unwrap()
                        .send((
                            published.upgrade().unwrap().current().index.changes_status,
                            active.load(Ordering::SeqCst),
                        ))
                        .unwrap();
                    released.lock().unwrap().recv().unwrap();
                })),
        ));
        let mut input = (*origin).clone();
        Arc::make_mut(&mut input.generation).changes = Some(Arc::new(source.clone()));
        let input = Arc::new(input);
        let pass = ChangesPass {
            publications: publications.clone(),
            comparisons: Arc::new(Unimock::new(())),
            diagnostics: Arc::new(Unimock::new(())),
            watching: false,
            activity: Some(Arc::new(Unimock::new(
                WriteActivityMock::enter
                    .some_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        admitted.fetch_add(1, Ordering::SeqCst);
                        Box::new(Activity(admitted.clone())) as Box<dyn WriteLease>
                    })),
            ))),
        };
        let (stop, stopping) = watch::channel(false);
        let run = tokio::spawn(async move { pass.run(input, stopping).await });
        let observed = entering.await.unwrap();
        if replace {
            let revision = publications.current().index.revision + 1;
            assert!(publications.replace(snapshot(None).at_revision(revision)));
        } else {
            stop.send_replace(true);
        }
        assert!(!run.is_finished(), "the owner must drain the admitted seed");
        release.send(()).unwrap();
        run.await.unwrap();
        assert_eq!(observed, (ChangesStatus::Unavailable, 0));
        assert_eq!(activity.load(Ordering::SeqCst), 0);
    }
}
