//! Mocked generations expose literal content proofs and counted comparison reads.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::ThreadId;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, DocumentProof, ProofMode};
use mokly_graph::error::GraphError;
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_html::{composition::Composed, parse};
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{CatalogueModel, EntryContent, ModelEntry};
use mokly_model::usage::CatalogueUsage;
use serde_json::json;
use sha2::{Digest, Sha256};
use unimock::{MockFn, Unimock, matching};

use crate::comparison::Engine;
use crate::comparison_types::{ComparisonRequest, ComparisonResult};
use crate::moves::Detector;

#[derive(Clone)]
pub(super) struct Fixture {
    pub(super) entries: Vec<ModelEntry>,
    pub(super) html: BTreeMap<String, String>,
    pub(super) resources: BTreeMap<String, Vec<u8>>,
    pub(super) known: bool,
    pub(super) failed_document: Option<String>,
    pub(super) failed_resources: bool,
    pub(super) documents: Arc<AtomicUsize>,
    pub(super) head_validations: Arc<AtomicUsize>,
    pub(super) workers: bool,
    pub(super) proof_threads: Arc<Mutex<Vec<ThreadId>>>,
}

impl Default for Fixture {
    fn default() -> Self {
        Self {
            entries: ["one", "two"].into_iter().map(|path| ModelEntry {
                metadata: serde_json::from_value(json!({"path":path,"title":path,"description":"","tags":[],"relatedDocs":[],"isIndex":false,"source":{"path":format!("specs/{path}.page.html"),"line":1,"column":1},"rootIndex":0})).unwrap(),
                content: EntryContent::Page,
            }).collect(),
            html: BTreeMap::from([("one".into(), "<p>one</p>".into()), ("two".into(), "<p>two</p>".into())]),
            resources: BTreeMap::new(),
            known: true,
            failed_document: None,
            failed_resources: false,
            documents: Arc::new(AtomicUsize::new(0)),
            head_validations: Arc::new(AtomicUsize::new(0)),
            workers: false,
            proof_threads: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

impl Fixture {
    pub(super) fn generation(&self, head: bool, prove: bool) -> Arc<dyn RenderGeneration> {
        let plans: BTreeMap<_, _> = self
            .entries
            .iter()
            .enumerate()
            .map(|(entry, model)| {
                let path = &model.metadata.path;
                let route = format!("{path}/index.html");
                (
                    route.clone(),
                    DocumentPlan {
                        resource_key: path.clone(),
                        key: key(NodeKind::Document, &[self.html[path].as_bytes()]),
                        route,
                        entry,
                        viewport: None,
                        color_scheme: ColorScheme::Light,
                        stylesheets: vec![],
                    },
                )
            })
            .collect();
        let catalogue = PreparedCatalogue {
            model: CatalogueModel {
                entries: self.entries.clone(),
                folders: vec![],
                sources: vec![],
                color_schemes: vec![ColorScheme::Light],
            },
            inventory: Default::default(),
            templates: Default::default(),
            documents: Default::default(),
            slot_fragments: Default::default(),
            elements: Default::default(),
            prop_validators: Default::default(),
            javascript: Default::default(),
            dependency_directories: Default::default(),
            warnings: vec![],
        };
        let html = self.html.clone();
        let documents = self.documents.clone();
        let proof = self.clone();
        let proof_threads = self.proof_threads.clone();
        let failed_document = self.failed_document.clone();
        let failed_resources = self.failed_resources;
        let common = (
            RenderGenerationMock::comparison_document_proof
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |source, route| {
                    proof_threads
                        .lock()
                        .unwrap()
                        .push(std::thread::current().id());
                    let artifact = source.comparison_document(route).ok()?;
                    let identity = source.comparison_identity(
                        ComparisonRead::Document,
                        route,
                        ProofMode::Current,
                    )?;
                    Some(DocumentProof {
                        identity,
                        usage: artifact
                            .document
                            .as_ref()
                            .map(|document| document.usage.clone()),
                    })
                })),
            RenderGenerationMock::catalogue
                .each_call(matching!())
                .returns(catalogue)
                .at_least_times(0),
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(plans)
                .at_least_times(0),
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(()))
                .at_least_times(0),
            RenderGenerationMock::comparison_document
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, route| {
                    if failed_document.as_deref() == Some(route) {
                        return Err(GraphError::InputsChanged { path: route.into() });
                    }
                    Ok(artifact(&html[route.strip_suffix("/index.html").unwrap()]))
                }))
                .at_least_times(0),
            RenderGenerationMock::closure
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    documents.fetch_add(1, Ordering::SeqCst);
                    Ok(Closure::default())
                }))
                .at_least_times(0),
        );
        let proof = RenderGenerationMock::comparison_identity
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, read, route, _| {
                proof.known.then(|| {
                    identity(match read {
                        ComparisonRead::Document | ComparisonRead::Closure => {
                            proof.html[route.strip_suffix("/index.html").unwrap()].as_bytes()
                        }
                        ComparisonRead::Resource => {
                            proof.resources.get(route).map_or(b"absent", Vec::as_slice)
                        }
                    })
                })
            }))
            .at_least_times(0);
        let head_validations = self.head_validations.clone();
        let validation = (
            RenderGenerationMock::render_all
                .each_call(matching!())
                .answers(&|_| Ok(RenderSummary::default()))
                .at_least_times(0),
            RenderGenerationMock::validate_head
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |generation, _| {
                    head_validations.fetch_add(1, Ordering::SeqCst);
                    generation.render_all()
                }))
                .at_least_times(0),
        );
        let workers = self.workers;
        let scheduling = RenderGenerationMock::schedule_comparison_stream
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, task, consumer| {
                let mut index = 0;
                while consumer.admit(index) {
                    if workers {
                        std::thread::scope(|scope| {
                            scope.spawn(|| task.run(index)).join().unwrap();
                        });
                    } else {
                        task.run(index);
                    }
                    if !consumer.consume(index) {
                        break;
                    }
                    index += 1;
                }
            }));
        let resource = RenderGenerationMock::resource_digest
            .some_call(matching!(_))
            .answers(&|_, route| Err(GraphError::InputsChanged { path: route.into() }));
        let generation: Arc<dyn RenderGeneration> =
            Arc::new(match (head, prove, failed_resources) {
                (false, true, false) => Unimock::new((common, proof, scheduling)),
                (true, true, false) => Unimock::new((common, proof, validation)),
                (false, false, false) => Unimock::new((common, scheduling)),
                (true, false, false) => Unimock::new((common, validation)),
                (false, true, true) => Unimock::new((common, proof, scheduling, resource)),
                (true, true, true) => Unimock::new((common, proof, validation, resource)),
                (false, false, true) => Unimock::new((common, scheduling, resource)),
                (true, false, true) => Unimock::new((common, validation, resource)),
            });
        if let Some(route) = generation.plans().keys().next() {
            let _ = generation.comparison_document_proof(route);
        }
        generation
    }
    pub(super) fn reads(&self) -> usize {
        self.documents.load(Ordering::SeqCst)
    }
    pub(super) fn clear(&self) {
        self.documents.store(0, Ordering::SeqCst);
        self.proof_threads.lock().unwrap().clear();
    }
}

pub(super) fn artifact(html: &str) -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: html.as_bytes().to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: parse::html(DeliveredHtml::document(html)),
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
pub(super) fn identity(bytes: &[u8]) -> ContentIdentity {
    Sha256::digest(bytes).into()
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
pub(super) fn review(result: &ComparisonResult) -> Vec<u8> {
    serde_json::to_vec(&result.review).unwrap()
}
