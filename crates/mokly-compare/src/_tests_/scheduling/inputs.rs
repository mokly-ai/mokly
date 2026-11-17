//! Pure documents, closures, and catalogue metadata for scheduling proofs.

use std::sync::Arc;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry, VisualEntry};
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::usage::CatalogueUsage;
use serde_json::json;

pub(super) fn route(index: usize) -> String {
    format!("screen/{index}.html")
}
pub(super) fn index(route: &str) -> usize {
    route
        .rsplit('/')
        .next()
        .unwrap()
        .split('.')
        .next()
        .unwrap()
        .parse()
        .unwrap()
}

pub(super) fn artifact(index: usize) -> Arc<Artifact> {
    let html = format!("<p>View {index}</p>");
    Arc::new(Artifact {
        bytes: html.as_bytes().to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: parse::html(DeliveredHtml::document(&html)),
            usage: CatalogueUsage::Ready {
                instances: vec![],
                slots: vec![],
                ranges: vec![],
            },
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    })
}

pub(super) fn closure(index: usize) -> Closure {
    Closure {
        evidence: vec![ResourceEvidence {
            path: format!("static/{index}.png"),
            owner: EvidenceOwner::Entry,
        }],
        ..Default::default()
    }
}

pub(super) fn catalogue() -> PreparedCatalogue {
    PreparedCatalogue {
        model: CatalogueModel { entries: vec![ModelEntry {
            metadata: serde_json::from_value(json!({"path":"screen","title":"Screen","description":"","tags":[],"relatedDocs":[],"isIndex":false,"source":{"path":"specs/screen.screen.html","line":1,"column":1},"rootIndex":0})).unwrap(),
            content: EntryContent::Screen { visual: VisualEntry { color_schemes: vec![ColorScheme::Light, ColorScheme::Dark],
                prop_schema: serde_json::from_value(json!({"type":"object","additionalProperties":false,"properties":{}})).unwrap(),
                props: Default::default(), controls: Default::default(), control_order: vec![] }, address: None, use_case_paths: vec![] }
        }], folders: vec![], sources: vec![], color_schemes: vec![ColorScheme::Light, ColorScheme::Dark] },
        inventory: Default::default(), templates: Default::default(), documents: Default::default(), slot_fragments: Default::default(),
        elements: Default::default(), prop_validators: Default::default(), javascript: Default::default(), dependency_directories: Default::default(), warnings: vec![] }
}
