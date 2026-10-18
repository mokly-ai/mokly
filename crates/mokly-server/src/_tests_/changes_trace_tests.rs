//! Classification and capture retain their caller across async and blocking work.

use std::sync::{Arc, Mutex};

use tokio::sync::watch;
use tracing::span::{Attributes, Id};
use tracing::{Instrument, Subscriber};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::{Context, SubscriberExt};
use tracing_subscriber::registry::LookupSpan;
use unimock::{MockFn, Unimock, matching};

use crate::changes::ChangeSourceMock;
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::clock::ClockMock;
use crate::comparison_capture::CapturerMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files, snapshot};
use crate::entropy::EntropyMock;
use crate::error::ServerError;
use crate::publication::{FixedPublication, SharedPublication};

type Parent = (&'static str, Option<&'static str>);

#[derive(Clone, Default)]
struct Parents(Arc<Mutex<Vec<Parent>>>);
impl<S: Subscriber + for<'a> LookupSpan<'a>> Layer<S> for Parents {
    fn on_new_span(&self, attributes: &Attributes<'_>, _: &Id, context: Context<'_, S>) {
        let parent = attributes
            .parent()
            .and_then(|id| context.span(id))
            .or_else(|| context.lookup_current());
        self.0
            .lock()
            .unwrap()
            .push((attributes.metadata().name(), parent.map(|span| span.name())));
    }
}

#[tokio::test]
async fn changes_and_capture_spans_parent_the_blocking_engine_work() {
    let parents = Parents::default();
    tracing::subscriber::set_global_default(tracing_subscriber::registry().with(parents.clone()))
        .unwrap();
    async {
        let (stop, stopping) = watch::channel(false);
        let source = Arc::new(Unimock::new((
            ChangeSourceMock::references
                .next_call(matching!(_))
                .returns(Ok("base".into())),
            ChangeSourceMock::classify
                .next_call(matching!(_, _))
                .answers(&|_, _, _| {
                    let _span = tracing::info_span!("review.test").entered();
                    Err(ServerError::ChangesUnavailable)
                }),
            ChangeSourceMock::finished
                .next_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| {
                    stop.send_replace(true);
                })),
        )));
        let mut origin = (*snapshot(None)).clone();
        Arc::make_mut(&mut origin.generation).changes = Some(source);
        let origin = Arc::new(origin);
        let pass = ChangesPass {
            publications: Arc::new(SharedPublication::new(origin.clone())),
            comparisons: Arc::new(Unimock::new(())),
            diagnostics: Arc::new(Unimock::new(())),
            watching: false,
        };
        pass.run(origin, stopping).await;
        let input = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
        let store = MemoryComparisons::new(
            Arc::new(Unimock::new(
                ClockMock::milliseconds.each_call(matching!()).returns(0u64),
            )),
            Arc::new(Unimock::new(
                EntropyMock::secret
                    .next_call(matching!())
                    .returns("a".repeat(64)),
            )),
            Arc::new(Unimock::new(
                CapturerMock::capture
                    .next_call(matching!(_, _, _, _))
                    .answers(&|_, _, _, _, _| {
                        let _span = tracing::info_span!("render.test").entered();
                        Ok(files())
                    }),
            )),
            Arc::new(FixedPublication::new(snapshot(Some(input.clone())))),
            Arc::new(Unimock::new(())),
        );
        store.selected(input, "sample".into(), false).await.unwrap();
        store.stop().await;
    }
    .instrument(tracing::info_span!("serve-test"))
    .await;
    let records = parents.0.lock().unwrap();
    for expected in [
        ("changes.classify", Some("serve-test")),
        ("review.test", Some("changes.classify")),
        ("review.capture", Some("serve-test")),
        ("render.test", Some("review.capture")),
    ] {
        assert!(
            records.contains(&expected),
            "missing {expected:?}: {records:?}"
        );
    }
}
