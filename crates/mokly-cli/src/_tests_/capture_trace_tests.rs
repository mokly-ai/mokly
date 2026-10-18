//! Capture failures keep error status and omit successful retention counts.

use std::sync::{Arc, Mutex};

use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::{Comparison, ComparisonRequest};
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::{Subscriber, subscriber};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::{Context, SubscriberExt};
use tracing_subscriber::registry::LookupSpan;
use unimock::{MockFn, Unimock, matching};

use super::stage;

#[derive(Clone, Default)]
struct Records(Arc<Mutex<Vec<String>>>);

impl Visit for Records {
    fn record_str(&mut self, field: &Field, value: &str) {
        self.0
            .lock()
            .unwrap()
            .push(format!("{}={value}", field.name()));
    }
    fn record_debug(&mut self, field: &Field, _: &dyn std::fmt::Debug) {
        self.0.lock().unwrap().push(field.name().into());
    }
}

impl<S> Layer<S> for Records
where
    S: Subscriber + for<'a> LookupSpan<'a>,
{
    fn on_new_span(&self, attrs: &Attributes<'_>, _: &Id, _: Context<'_, S>) {
        if attrs.metadata().name() == "review.capture-side" {
            attrs.record(&mut self.clone());
        }
    }
    fn on_record(&self, id: &Id, record: &Record<'_>, context: Context<'_, S>) {
        if context.span(id).unwrap().name() == "review.capture-side" {
            record.record(&mut self.clone());
        }
    }
}

#[test]
fn failed_capture_never_records_ok_or_success_counts() {
    assert!(stage("review.capture-side"));
    let records = Records::default();
    let trace = tracing_subscriber::registry().with(records.clone());
    subscriber::with_default(trace, || {
        let engine = Engine {
            moves: Arc::new(Unimock::new(())),
            css: Arc::new(MemoryParsedCss::new(1024)),
        };
        let before = Arc::new(Unimock::new((
            RenderGenerationMock::comparison_capture
                .next_call(matching!())
                .returns(None),
            RenderGenerationMock::render_all
                .next_call(matching!())
                .returns(Err(GraphError::Runtime {
                    source: RuntimeDiagnostic {
                        code: RuntimeCode::Cancelled,
                        message: "private cancellation detail".into(),
                    },
                })),
        )));
        let request = ComparisonRequest {
            base_ref: "base".into(),
            base_commit: "a".repeat(40),
            catalogue_identity: "b".repeat(64),
        };
        assert!(
            engine
                .compare(&request, before, Arc::new(Unimock::new(())))
                .is_err()
        );
    });
    assert_eq!(*records.0.lock().unwrap(), ["status=error"]);
}
