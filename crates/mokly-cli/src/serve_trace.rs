//! Opt-in structured timing output excludes source data and error payloads.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use serde_json::{Map, Value, json};
use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::{Context, SubscriberExt};
use tracing_subscriber::registry::LookupSpan;

use crate::terminal::Terminal;

pub(super) struct Timings {
    terminal: Arc<dyn Terminal>,
    session: String,
    started: Instant,
    next: AtomicU64,
}

pub(super) fn install(terminal: Arc<dyn Terminal>, session: String) -> bool {
    let layer = Timings {
        terminal,
        session,
        started: Instant::now(),
        next: AtomicU64::new(1),
    };
    tracing::subscriber::set_global_default(tracing_subscriber::registry().with(layer)).is_ok()
}

struct SpanTiming {
    id: u64,
    parent: Option<u64>,
    stage: &'static str,
    started: u64,
    fields: Fields,
    documents: u64,
    fragments: u64,
    cache_hits: u64,
}

#[derive(Default)]
struct Fields {
    values: Map<String, Value>,
    error: bool,
    cache_hit: bool,
}
impl Visit for Fields {
    fn record_str(&mut self, field: &Field, value: &str) {
        match field.name() {
            "viewport" | "scheme" | "action" | "operation" => {
                self.values.insert(field.name().into(), json!(value));
            }
            "status" => self.error = value == "error",
            _ => {}
        }
    }
    fn record_u64(&mut self, field: &Field, value: u64) {
        if field.name() == "worker" {
            self.values.insert("worker".into(), json!(value));
        }
    }
    fn record_bool(&mut self, field: &Field, value: bool) {
        if field.name() == "cache_hit" {
            self.cache_hit = value;
        }
    }
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        if matches!(field.name(), "viewport" | "scheme" | "action") {
            self.record_str(field, &format!("{value:?}"));
        }
    }
}

fn stage(name: &str) -> bool {
    matches!(
        name,
        "serve.ready"
            | "watch.action"
            | "serve.background"
            | "config.load"
            | "catalogue.discover"
            | "catalogue.validate"
            | "catalogue.describe"
            | "graph.prepare"
            | "render.document"
            | "render.fragment"
            | "css.bundle"
            | "css.postcss"
            | "index.build"
            | "detail.build"
            | "build"
            | "publish"
            | "output.write"
            | "output.stage"
            | "output.install"
            | "output.capture"
            | "output.rollback"
            | "output.cleanup"
            | "review.base-commit"
            | "review.base-tree"
            | "review.base-dependencies"
            | "review.compare-views"
            | "review.resource-graph"
            | "review.css-analysis"
            | "review.capture"
            | "upload.plan"
            | "upload.blobs"
            | "upload.complete"
    )
}

impl Timings {
    fn elapsed(&self) -> u64 {
        self.started
            .elapsed()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX)
    }
    fn emit(&self, span: &SpanTiming, event: &str) {
        let elapsed = self.elapsed();
        let mut record = json!({"schemaVersion":1,"session":self.session,"pid":std::process::id(),
            "role":"core","stage":span.stage,"id":span.id,"event":event,"elapsedMs":elapsed});
        if let Some(parent) = span.parent {
            record["parentId"] = json!(parent);
        }
        for (key, value) in &span.fields.values {
            record[key] = value.clone();
        }
        if event == "end" {
            record["durationMs"] = json!(elapsed.saturating_sub(span.started));
            record["status"] = json!(if span.fields.error { "error" } else { "ok" });
        } else if event == "counts" {
            record["documents"] = json!(span.documents);
            record["fragments"] = json!(span.fragments);
            record["cacheHits"] = json!(span.cache_hits);
        }
        self.terminal.stderr(&format!("[mokly:timing] {record}\n"));
    }
}

impl<S> Layer<S> for Timings
where
    S: Subscriber + for<'a> LookupSpan<'a>,
{
    fn on_new_span(&self, attributes: &Attributes<'_>, id: &Id, context: Context<'_, S>) {
        let name = attributes.metadata().name();
        if !stage(name) {
            return;
        }
        let Some(span) = context.span(id) else {
            return;
        };
        let parent = span.parent().and_then(|parent| {
            parent
                .scope()
                .find_map(|span| span.extensions().get::<SpanTiming>().map(|value| value.id))
        });
        let mut fields = Fields::default();
        attributes.record(&mut fields);
        let timing = SpanTiming {
            id: self.next.fetch_add(1, Ordering::SeqCst),
            parent,
            stage: name,
            started: self.elapsed(),
            fields,
            documents: 0,
            fragments: 0,
            cache_hits: 0,
        };
        self.emit(&timing, "start");
        span.extensions_mut().insert(timing);
    }
    fn on_record(&self, id: &Id, values: &Record<'_>, context: Context<'_, S>) {
        if let Some(span) = context.span(id)
            && let Some(timing) = span.extensions_mut().get_mut::<SpanTiming>()
        {
            values.record(&mut timing.fields);
        }
    }
    fn on_event(&self, event: &Event<'_>, context: Context<'_, S>) {
        let mut fields = Fields::default();
        event.record(&mut fields);
        if let Some(operation) = fields.values.get("operation") {
            let record = json!({"schemaVersion":1,"session":self.session,"pid":std::process::id(),"role":"core","stage":"sidecar.operation","event":"counts","id":self.next.fetch_add(1, Ordering::SeqCst),"elapsedMs":self.elapsed(),"operation":operation,"worker":fields.values.get("worker"),"count":1});
            self.terminal.stderr(&format!("[mokly:timing] {record}\n"));
        }

        if *event.metadata().level() == Level::ERROR
            && let Some(span) = context.event_span(event)
            && let Some(timing) = span.extensions_mut().get_mut::<SpanTiming>()
        {
            timing.fields.error = true;
        }
    }
    fn on_close(&self, id: Id, context: Context<'_, S>) {
        let Some(span) = context.span(&id) else {
            return;
        };
        let Some(timing) = span.extensions_mut().remove::<SpanTiming>() else {
            return;
        };
        for parent in span.scope().skip(1) {
            let mut extensions = parent.extensions_mut();
            if let Some(background) = extensions.get_mut::<SpanTiming>()
                && background.stage == "serve.background"
            {
                if timing.stage == "render.document" {
                    background.documents += 1;
                    background.cache_hits += u64::from(timing.fields.cache_hit);
                }
                if timing.stage == "render.fragment" {
                    background.fragments += 1;
                }
                break;
            }
        }
        if timing.stage == "serve.background" {
            self.emit(&timing, "counts");
        }
        self.emit(&timing, "end");
    }
}
