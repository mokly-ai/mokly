//! Bounded base inputs replay exact documents while uncaptured inputs use their source.

use std::collections::{BTreeMap, BTreeSet};
use std::mem;
use std::sync::{Arc, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::error::Result;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{
    ComparisonCapture, DocumentPlan, RenderGeneration, RenderSummary, TemporaryDocument,
};
use mokly_model::data::Props;

use crate::capture_codec::EncodedView;
use crate::capture_error;
use crate::capture_styles::{self, EncodedResource};
use crate::capture_weight::{self, Budget, DEFAULT_BASE_CAPTURE_BYTES};

struct CapturedView {
    document: EncodedView,
    closure: Closure,
}

struct CapturedGeneration {
    source: Arc<dyn RenderGeneration>,
    views: BTreeMap<String, CapturedView>,
    summary: RenderSummary,
    styles: BTreeMap<String, EncodedResource>,
    retained_bytes: usize,
    encoded_bytes: usize,
}

/// The result owns bounded base inputs; the original source handles every cache miss.
pub(crate) fn capture(source: Arc<dyn RenderGeneration>) -> Result<Arc<dyn RenderGeneration>> {
    capture_with_bound(source, DEFAULT_BASE_CAPTURE_BYTES)
}

#[tracing::instrument(name = "review.capture-side", skip_all, fields(status = "error", views = tracing::field::Empty, uncaptured_views = tracing::field::Empty, retained_bytes = tracing::field::Empty, encoded_bytes = tracing::field::Empty))]
pub(crate) fn capture_with_bound(
    source: Arc<dyn RenderGeneration>,
    bound: usize,
) -> Result<Arc<dyn RenderGeneration>> {
    let source = if let Some(previous) = source.comparison_capture() {
        if previous.retained_bytes <= bound {
            complete(
                previous.views,
                previous.source.plans().len(),
                previous.retained_bytes,
                previous.encoded_bytes,
            );
            return Ok(source);
        }
        previous.source
    } else {
        source
    };
    let summary = source.render_all()?;
    let mut budget = Budget::new(bound);
    if !budget.retain(mem::size_of::<CapturedGeneration>() + capture_weight::summary(&summary)) {
        complete(0, summary.documents, 0, 0);
        return Ok(source);
    }
    let styles = capture_styles::capture(source.as_ref(), &mut budget)?;
    let mut encoded_bytes = styles
        .values()
        .map(EncodedResource::encoded_bytes)
        .sum::<usize>();
    let mut views = BTreeMap::new();
    for route in source.plans().keys() {
        source.check_cancelled()?;
        let artifact = source.comparison_document(route)?;
        let document = capture_error::graph(EncodedView::encode(&artifact))?;
        let closure = source.closure(route)?;
        let cost =
            256 + route.len() + document.retained_bytes() + capture_weight::closure(&closure);
        if budget.retain(cost) {
            encoded_bytes += document.bytes();
            views.insert(route.clone(), CapturedView { document, closure });
        }
    }
    complete(
        views.len(),
        summary.documents,
        budget.retained,
        encoded_bytes,
    );
    Ok(Arc::new(CapturedGeneration {
        source,
        views,
        summary,
        styles,
        retained_bytes: budget.retained,
        encoded_bytes,
    }))
}

fn complete(views: usize, total: usize, retained: usize, encoded: usize) {
    let span = tracing::Span::current();
    span.record("views", views as u64);
    span.record("uncaptured_views", total.saturating_sub(views) as u64);
    span.record("retained_bytes", retained as u64);
    span.record("encoded_bytes", encoded as u64);
    span.record("status", "ok");
}

impl GeneratedResources for CapturedGeneration {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        if let Some(style) = self
            .styles
            .get(route)
            .filter(|resource| resource.retains_bytes())
        {
            return capture_error::graph(style.read());
        }
        self.source.resource(route)
    }
    fn is_document(&self, route: &str) -> bool {
        self.source.is_document(route)
    }
}

impl RenderGeneration for CapturedGeneration {
    fn check_cancelled(&self) -> Result<()> {
        self.source.check_cancelled()
    }

    fn comparison_capture(&self) -> Option<ComparisonCapture> {
        Some(ComparisonCapture {
            source: self.source.clone(),
            views: self.views.len(),
            retained_bytes: self.retained_bytes,
            encoded_bytes: self.encoded_bytes,
        })
    }

    fn generation_key(&self) -> &str {
        self.source.generation_key()
    }
    fn plans(&self) -> &BTreeMap<String, DocumentPlan> {
        self.source.plans()
    }
    fn catalogue(&self) -> &PreparedCatalogue {
        self.source.catalogue()
    }
    fn render(&self, route: &str) -> Result<Arc<Artifact>> {
        self.comparison_document(route)
    }
    fn comparison_document(&self, route: &str) -> Result<Arc<Artifact>> {
        if let Some(view) = self.views.get(route) {
            return Ok(Arc::new(capture_error::graph(view.document.restore())?));
        }
        self.source.comparison_document(route)
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        if let Some(view) = self.views.get(route) {
            return Ok(view.closure.clone());
        }
        self.source.closure(route)
    }
    fn render_all(&self) -> Result<RenderSummary> {
        Ok(self.summary.clone())
    }
    fn render_props(&self, route: &str, props: &Props) -> Result<TemporaryDocument> {
        self.source.render_props(route, props)
    }
    fn resource_bytes(&self, route: &str) -> Result<Option<Vec<u8>>> {
        if let Some(style) = route
            .strip_prefix("static/mokly-generated/")
            .and_then(|route| self.styles.get(route))
            .filter(|resource| resource.retains_bytes())
        {
            return capture_error::graph(style.read());
        }
        self.source.resource_bytes(route)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        if let Some(style) = route
            .strip_prefix("static/mokly-generated/")
            .and_then(|route| self.styles.get(route))
        {
            return Ok(style.digest.clone());
        }
        self.source.resource_digest(route)
    }
    fn resource_routes(&self) -> Vec<String> {
        self.source.resource_routes()
    }
    fn stylesheet_directories(&self) -> &[DirectoryDependency] {
        self.source.stylesheet_directories()
    }
    fn public_files(&self) -> BTreeSet<String> {
        self.source.public_files()
    }
    fn watch_files(&self) -> BTreeSet<String> {
        self.source.watch_files()
    }
    fn observe_resources(&self, observer: Weak<dyn ResourceObserver>) {
        self.source.observe_resources(observer);
    }
    fn contains_public_file(&self, path: &str) -> bool {
        self.source.contains_public_file(path)
    }
}

#[cfg(test)]
#[path = "_tests_/comparison_capture_tests.rs"]
mod comparison_capture_tests;

#[cfg(test)]
#[path = "_tests_/capture_cancellation_tests.rs"]
mod capture_cancellation_tests;
