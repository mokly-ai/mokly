//! Opt-in structured timing output excludes source data and error payloads.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use mokly_cli::redaction::Redactor;
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::workers::Clock;
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
    clock: Arc<dyn Clock>,
    next: AtomicU64,
    redactor: Arc<Redactor>,
}

pub(super) fn install(
    terminal: Arc<dyn Terminal>,
    session: String,
    redactor: Arc<Redactor>,
) -> bool {
    let layer = Timings {
        terminal,
        session,
        clock: Arc::new(SystemClock::default()),
        next: AtomicU64::new(1),
        redactor,
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
    counts: Map<String, Value>,
    error: bool,
    cache_hit: bool,
    sidecar_timing: Option<String>,
}
impl Visit for Fields {
    fn record_str(&mut self, field: &Field, value: &str) {
        match field.name() {
            "viewport" | "scheme" | "action" | "operation" => {
                self.values.insert(field.name().into(), json!(value));
            }
            "status" => self.error = value == "error",
            "sidecar_timing" => self.sidecar_timing = Some(value.to_owned()),
            _ => {}
        }
    }
    fn record_u64(&mut self, field: &Field, value: u64) {
        match field.name() {
            "views" | "unchanged" | "changed" | "ignored_only" => {
                let name = if field.name() == "ignored_only" {
                    "ignoredOnly"
                } else {
                    field.name()
                };
                self.counts.insert(name.into(), json!(value));
            }
            "worker" | "tier" | "input_paths" | "read_bytes" | "retained_bytes" => {
                let name = match field.name() {
                    "input_paths" => "inputPaths",
                    "read_bytes" => "readBytes",
                    "retained_bytes" => "retainedBytes",
                    name => name,
                };
                self.values.insert(name.into(), json!(value));
            }
            _ => {}
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
            | "output.fingerprint"
            | "output.input-digests"
            | "output.input-read"
            | "output.recheck"
            | "output.stage"
            | "output.install"
            | "output.capture"
            | "output.rollback"
            | "output.cleanup"
            | "changes.classify"
            | "review.base-commit"
            | "review.base-tree"
            | "review.base-dependencies"
            | "review.changed-paths"
            | "review.compare-views"
            | "review.resource-graph"
            | "review.css-analysis"
            | "review.capture"
            | "sidecar.spawn"
            | "sidecar.recycle"
            | "upload.plan"
            | "upload.blobs"
            | "upload.complete"
    )
}

impl Timings {
    fn elapsed(&self) -> u64 {
        self.clock.now_ms()
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
        if event == "counts" && span.stage == "review.compare-views" {
            for (key, value) in &span.fields.counts {
                record[key] = value.clone();
            }
        }
        if event == "end" {
            record["durationMs"] = json!(elapsed.saturating_sub(span.started));
            record["status"] = json!(if span.fields.error { "error" } else { "ok" });
        } else if event == "counts" && span.stage == "serve.background" {
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
        if let Some(line) = fields.sidecar_timing {
            self.terminal
                .stderr(&format!("{}\n", self.redactor.safe(&line)));
            return;
        }
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
        if timing.stage == "serve.background"
            || (timing.stage == "review.compare-views"
                && timing.fields.counts.contains_key("views"))
        {
            self.emit(&timing, "counts");
        }
        self.emit(&timing, "end");
    }
}

#[cfg(test)]
#[path = "_tests_/serve_trace_tests.rs"]
mod serve_trace_tests;

#[cfg(test)]
#[path = "_tests_/sidecar_trace_tests.rs"]
mod sidecar_trace_tests;
