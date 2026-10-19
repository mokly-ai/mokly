//! Pure catalogue inputs and source mocks that reject post-capture base work.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::{Closure, GeneratedResourcesMock};
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry};
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::usage::CatalogueUsage;
use mokly_model::{material, namespace};
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::comparison::Engine;
use crate::comparison_types::ComparisonRequest;
use crate::moves::Detector;

pub(super) const STYLES: [&str; 2] = ["styles/shared.css", "assets/imported.css"];

#[derive(Default)]
pub(super) struct Probe {
    pub(super) head_started: AtomicBool,
    pub(super) events: Mutex<Vec<(&'static str, &'static str, bool)>>,
    pub(super) forbid_base_after_head: bool,
    pub(super) capture_base: bool,
}

impl Probe {
    fn record(&self, side: &'static str, operation: &'static str) {
        let head = self.head_started.load(Ordering::SeqCst);
        assert!(
            !(self.forbid_base_after_head && side == "base" && head),
            "base source {operation} after capture"
        );
        self.events.lock().unwrap().push((side, operation, head));
    }
}

pub(super) fn engine() -> Engine {
    Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(4096)),
    }
}

pub(super) fn request() -> ComparisonRequest {
    ComparisonRequest {
        base_ref: "base".into(),
        base_commit: "b".repeat(40),
        catalogue_identity: "a".repeat(64),
    }
}

pub(super) fn generation(
    side: &'static str,
    count: usize,
    probe: Arc<Probe>,
    closure_members: usize,
) -> Arc<dyn RenderGeneration> {
    let mut plans = BTreeMap::new();
    let mut artifacts = BTreeMap::new();
    let mut closures = BTreeMap::new();
    let mut entries = Vec::new();
    let mut resources: BTreeMap<String, Vec<u8>> = STYLES
        .iter()
        .map(|route| {
            (
                namespace::generated(route),
                b"p { outline-color: red; }".to_vec(),
            )
        })
        .collect();
    for index in 0..count {
        let path = format!("page-{index}");
        let route = format!("{path}/index.html");
        let asset = namespace::generated(&format!("assets/{index}.png"));
        resources.insert(asset.clone(), format!("{side}-{index}").into_bytes());
        entries.push(ModelEntry {
            metadata: serde_json::from_value(json!({"path":path,"title":path,"description":"","tags":[],"relatedDocs":[],"isIndex":false,"source":{"path":format!("specs/{path}.page.html"),"line":1,"column":1},"rootIndex":0})).unwrap(),
            content: EntryContent::Page,
        });
        plans.insert(
            route.clone(),
            DocumentPlan {
                route: route.clone(),
                resource_key: "resources".into(),
                key: key(NodeKind::Document, &[route.as_bytes(), side.as_bytes()]),
                entry: index,
                viewport: None,
                color_scheme: ColorScheme::Light,
                stylesheets: vec![],
            },
        );
        let html = format!("<!doctype html><p>{side} {index}</p><img src='/{}'>", asset);
        artifacts.insert(
            route.clone(),
            Arc::new(Artifact {
                bytes: html.as_bytes().to_vec(),
                content_type: "text/html".into(),
                fragment: None,
                document: Some(Composed {
                    tree: parse::document(&html),
                    usage: CatalogueUsage::Unavailable,
                    warnings: vec![],
                    resources: vec![],
                    components: vec![],
                    links: vec![],
                }),
            }),
        );
        closures.insert(
            route,
            Closure {
                files: (0..closure_members)
                    .map(|index| format!("public/{index}.svg"))
                    .collect(),
                evidence: STYLES
                    .iter()
                    .map(|route| namespace::generated(route))
                    .chain([asset])
                    .map(|path| ResourceEvidence {
                        path,
                        owner: EvidenceOwner::Entry,
                    })
                    .collect(),
                ..Default::default()
            },
        );
    }
    let catalogue = PreparedCatalogue {
        model: CatalogueModel {
            entries,
            folders: vec![],
            sources: vec![],
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Default::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        javascript: Default::default(),
        deferred_modules: vec![],
        warnings: vec![],
    };
    let routes = resources
        .keys()
        .map(|route| {
            route
                .strip_prefix("static/mokly-generated/")
                .unwrap()
                .into()
        })
        .collect::<Vec<String>>();
    let render_probe = probe.clone();
    let render_artifacts = artifacts.clone();
    let read_probe = probe.clone();
    let document_probe = probe.clone();
    let closure_probe = probe.clone();
    let digest_probe = probe.clone();
    let digest_resources = resources.clone();
    let generated_resources = resources.clone();
    let generated_probe = probe.clone();
    let capture = probe.capture_base;
    let common = (
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::render_all
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                if side == "head" {
                    probe.head_started.store(true, Ordering::SeqCst);
                }
                probe.record(side, "all");
                Ok(RenderSummary {
                    documents: count,
                    ..Default::default()
                })
            })),
        RenderGenerationMock::comparison_document
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                document_probe.record(side, "document");
                Ok(artifacts[route].clone())
            })),
        RenderGenerationMock::closure
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                closure_probe.record(side, "closure");
                Ok(closures[route].clone())
            })),
        RenderGenerationMock::resource_digest
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                digest_probe.record(side, "digest");
                Ok(digest_resources
                    .get(route)
                    .map(|bytes| material::digest(bytes)))
            })),
    );
    let render = RenderGenerationMock::render
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, route| {
            render_probe.record(side, "render");
            Ok(render_artifacts[route].clone())
        }));
    let read = RenderGenerationMock::resource_bytes
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, route| {
            read_probe.record(side, "bytes");
            Ok(resources.get(route).cloned())
        }));
    let generated = GeneratedResourcesMock::resource
        .each_call(matching!(_))
        .answers_arc(Arc::new(move |_, route| {
            generated_probe.record(side, "generated");
            Ok(generated_resources
                .get(&namespace::generated(route))
                .cloned())
        }));
    let capture_info = RenderGenerationMock::comparison_capture
        .each_call(matching!())
        .returns(None);
    let routes = RenderGenerationMock::resource_routes
        .each_call(matching!())
        .returns(routes);
    if side == "head" {
        Arc::new(Unimock::new((common, render, read)))
    } else if capture {
        Arc::new(Unimock::new((common, routes, generated, capture_info)))
    } else {
        Arc::new(Unimock::new((common, read, capture_info)))
    }
}
