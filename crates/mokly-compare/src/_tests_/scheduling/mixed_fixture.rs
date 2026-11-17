//! Mixed retained and deferred inputs use injected IO with real worker scheduling.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::html_input::DeliveredHtml;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_graph::workers::{RenderWorkers, ThreadWorkers};
use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::evidence::{EvidenceOwner, ResourceEvidence};
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use super::inputs;
use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::LosslessRestorer;
use crate::comparison_capture::CapturedView;

pub(super) fn generation(head: bool, parallel: bool) -> Arc<dyn RenderGeneration> {
    let paths = if head {
        ["changed", "stable", "ignored", "moved", "added", "styled"]
    } else {
        ["changed", "stable", "ignored", "old", "removed", "styled"]
    };
    let mut catalogue: PreparedCatalogue = inputs::catalogue();
    let template = catalogue.model.entries[0].clone();
    catalogue.model.entries.clear();
    let mut plans = BTreeMap::new();
    let mut artifacts = BTreeMap::new();
    let mut closures = BTreeMap::new();
    let mut retained = BTreeMap::new();
    for (entry, path) in paths.iter().enumerate() {
        let mut metadata = template.clone();
        metadata.metadata.path = (*path).into();
        metadata.metadata.title = if *path == "moved" {
            "old".into()
        } else {
            (*path).into()
        };
        metadata.metadata.source.path = format!("specs/{path}.screen.html");
        metadata.metadata.moved_from = (*path == "moved").then(|| "old".into());
        catalogue.model.entries.push(metadata);
        for index in 0..4 {
            let route = format!("{path}/{index}.html");
            let html = match (*path, head) {
                ("changed", true) if index == 0 => "<p>After</p>",
                ("changed", _) => "<p>Before</p>",
                ("ignored", true) => "<p>Same</p><mokly-ignore id=\"chrome\">After</mokly-ignore>",
                ("ignored", false) => {
                    "<p>Same</p><mokly-ignore id=\"chrome\">Before</mokly-ignore>"
                }
                ("styled", _) => {
                    "<link rel=\"stylesheet\" href=\"../../style.css\"><p class=\"styled\">Style</p>"
                }
                ("added", _) => "<p>Added</p>",
                ("removed", _) => "<p>Removed</p>",
                _ => "<p>Same</p>",
            };
            let artifact = Arc::new(Artifact {
                bytes: html.as_bytes().to_vec(),
                content_type: "text/html".into(),
                fragment: None,
                document: Some(Composed {
                    tree: composed_tree(html),
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
            });
            let closure = Closure {
                warnings: if head {
                    vec![]
                } else {
                    vec![Warning {
                        code: "fixture-warning",
                        subject: WarningSubject::Route(route.clone()),
                        message: "retained warning".into(),
                    }]
                },
                evidence: if *path == "styled" {
                    vec![ResourceEvidence {
                        path: "static/style.css".into(),
                        owner: EvidenceOwner::Entry,
                    }]
                } else {
                    vec![]
                },
                ..Default::default()
            };
            plans.insert(
                route.clone(),
                DocumentPlan {
                    key: key(NodeKind::Document, &[route.as_bytes()]),
                    resource_key: route.clone(),
                    route: route.clone(),
                    entry,
                    viewport: Some(if index < 2 {
                        Viewport::Mobile
                    } else {
                        Viewport::Desktop
                    }),
                    color_scheme: if index % 2 == 0 {
                        ColorScheme::Light
                    } else {
                        ColorScheme::Dark
                    },
                    stylesheets: vec![],
                },
            );
            if index < 3 {
                retained.insert(
                    route.clone(),
                    CapturedView {
                        document: EncodedView::encode(&artifact).unwrap(),
                        closure: closure.clone(),
                    },
                );
            }
            artifacts.insert(route.clone(), artifact);
            closures.insert(route, closure);
        }
    }
    let css = if head {
        b".styled{color:blue}".to_vec()
    } else {
        b".styled{color:red}".to_vec()
    };
    let common = (
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers(&|_| Ok(())),
        RenderGenerationMock::comparison_document
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| Ok(artifacts[route].clone()))),
        RenderGenerationMock::closure
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| Ok(closures[route].clone()))),
        RenderGenerationMock::resource_bytes
            .each_call(matching!("static/style.css"))
            .answers_arc(Arc::new(move |_, _| Ok(Some(css.clone())))),
        RenderGenerationMock::render_all
            .each_call(matching!())
            .answers(&|_| Ok(RenderSummary::default()))
            .at_least_times(0),
    );
    let source: Arc<dyn RenderGeneration> = if parallel && !head {
        let pool: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(4).unwrap());
        let scheduling = pool.clone();
        Arc::new(Unimock::new((
            common,
            RenderGenerationMock::comparison_parallelism
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| pool.comparison_parallelism())),
            RenderGenerationMock::schedule_comparison_tasks
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, count, task| {
                    scheduling.comparison_tasks(count, task)
                })),
        )))
    } else {
        Arc::new(Unimock::new(common))
    };
    if head {
        source
    } else {
        source.render_all().unwrap();
        Arc::new(CapturedGeneration {
            source,
            views: retained,
            summary: RenderSummary::default(),
            styles: BTreeMap::new(),
            retained_bytes: 0,
            encoded_bytes: 0,
            restorer: Box::new(LosslessRestorer),
        })
    }
}

fn composed_tree(html: &str) -> Vec<Node> {
    let mut nodes = parse::html(DeliveredHtml::document(html));
    annotate(&mut nodes);
    nodes
}

fn annotate(nodes: &mut [Node]) {
    for node in nodes {
        if let Node::Element(element) = node
            && element.name == "mokly-ignore"
        {
            *node = Node::Region {
                region: Region {
                    id: "ignore-1".into(),
                    kind: RegionKind::Ignore {
                        id: "chrome".into(),
                        material_key: None,
                    },
                },
                children: element.children.clone(),
            };
        }
        if let Some(children) = node.children_mut() {
            annotate(children);
        }
    }
}
