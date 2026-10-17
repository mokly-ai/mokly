//! Capture one source root at a time, then replay exact inputs without sidecar work.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Weak};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::dependencies::DirectoryDependency;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResources};
use mokly_graph::error::Result;
use mokly_graph::resource_inputs::ResourceObserver;
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderSummary, TemporaryDocument};
use mokly_model::data::Props;

use crate::capture_codec::EncodedView;
use crate::capture_error::{self, CaptureInternalError};
use crate::capture_styles::{self, EncodedStyle};

struct CapturedView {
    document: EncodedView,
    closure: Closure,
}

struct CapturedGeneration {
    source: Arc<dyn RenderGeneration>,
    views: BTreeMap<String, CapturedView>,
    summary: RenderSummary,
    styles: BTreeMap<String, EncodedStyle>,
}

/// The result owns immutable encoded inputs, never a catalogue-wide parsed tree set.
#[tracing::instrument(name = "review.capture-side", skip_all, err)]
pub(crate) fn capture(source: Arc<dyn RenderGeneration>) -> Result<Arc<dyn RenderGeneration>> {
    let summary = source.render_all()?;
    let styles = capture_styles::capture(source.as_ref())?;
    let mut views = BTreeMap::new();
    let mut bytes = 0;
    for route in source.plans().keys() {
        let artifact = source.comparison_document(route)?;
        let document = capture_error::graph(EncodedView::encode(&artifact))?;
        let closure = source.closure(route)?;
        bytes += document.bytes();
        views.insert(route.clone(), CapturedView { document, closure });
    }
    tracing::debug!(
        views = views.len(),
        encoded_bytes = bytes,
        "comparison inputs captured"
    );
    Ok(Arc::new(CapturedGeneration {
        source,
        views,
        summary,
        styles,
    }))
}

impl CapturedGeneration {
    fn view(&self, route: &str) -> Result<&CapturedView> {
        capture_error::graph(self.views.get(route).ok_or_else(|| {
            CaptureInternalError::Missing {
                route: route.into(),
            }
            .into()
        }))
    }
}

impl GeneratedResources for CapturedGeneration {
    fn resource(&self, route: &str) -> Result<Option<Vec<u8>>> {
        if let Some(style) = self.styles.get(route) {
            return Ok(Some(capture_error::graph(style.read())?));
        }
        self.source.resource(route)
    }
    fn is_document(&self, route: &str) -> bool {
        self.source.is_document(route)
    }
}

impl RenderGeneration for CapturedGeneration {
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
        Ok(Arc::new(capture_error::graph(
            self.view(route)?.document.restore(),
        )?))
    }
    fn closure(&self, route: &str) -> Result<Closure> {
        Ok(self.view(route)?.closure.clone())
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
        {
            return Ok(Some(capture_error::graph(style.read())?));
        }
        self.source.resource_bytes(route)
    }
    fn resource_digest(&self, route: &str) -> Result<Option<String>> {
        if let Some(style) = route
            .strip_prefix("static/mokly-generated/")
            .and_then(|route| self.styles.get(route))
        {
            return Ok(Some(style.digest.clone()));
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
