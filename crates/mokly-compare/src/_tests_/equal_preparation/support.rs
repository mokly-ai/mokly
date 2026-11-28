//! Counted retained restoration and checked head reads at the preparation boundary.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_error::Result;
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_html::composition::Composed;
use mokly_html::parse;
use mokly_html::tree::{Node, Region, RegionKind};
use mokly_model::axes::ColorScheme;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::DocumentRestorer;
use crate::comparison_capture::CapturedView;
use crate::comparison_preparation::{Preparation, PreparedView, ViewInput, ViewPreparation};

pub(super) const ROUTE: &str = "Home/index.desktop.html";

struct CountedRestorer(Arc<AtomicUsize>);

impl DocumentRestorer for CountedRestorer {
    fn proves_restore(&self) -> bool {
        true
    }

    fn restore(&self, view: &EncodedView) -> Result<Artifact> {
        self.0.fetch_add(1, Ordering::SeqCst);
        view.restore()
    }
}

pub(super) fn artifact() -> Artifact {
    let html = "<p class=\"content\">Same</p>";
    Artifact {
        bytes: html.as_bytes().to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: vec![Node::Region {
                region: Region {
                    id: "r-1".into(),
                    kind: RegionKind::Ignore {
                        id: "chrome".into(),
                        material_key: None,
                    },
                },
                children: parse::html(DeliveredHtml::fragment(html)),
            }],
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
    }
}

pub(super) fn prepare(before: Artifact, after: Artifact) -> (PreparedView, usize) {
    prepare_options(before, after, true, false, ROUTE)
}

fn plans() -> BTreeMap<String, DocumentPlan> {
    BTreeMap::from([(
        ROUTE.into(),
        DocumentPlan {
            resource_key: "same inputs".into(),
            route: ROUTE.into(),
            key: key(NodeKind::Document, &[b"same inputs"]),
            entry: 0,
            viewport: None,
            color_scheme: ColorScheme::Light,
            stylesheets: vec![],
        },
    )])
}

pub(super) fn prepare_options(
    before: Artifact,
    after: Artifact,
    paths_preserved: bool,
    moved: bool,
    after_route: &str,
) -> (PreparedView, usize) {
    let restores = Arc::new(AtomicUsize::new(0));
    let before: &dyn RenderGeneration = &CapturedGeneration {
        source: Arc::new(Unimock::new(
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(plans()),
        )),
        views: BTreeMap::from([(
            ROUTE.into(),
            CapturedView::encode(&before, Closure::default()).unwrap(),
        )]),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(CountedRestorer(restores.clone())),
    };
    let after = Unimock::new((
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans()),
        RenderGenerationMock::comparison_document
            .some_call(matching!(_))
            .returns(Ok(Arc::new(after)))
            .once(),
        RenderGenerationMock::closure
            .some_call(matching!(_))
            .returns(Ok(Closure::default()))
            .once(),
    ));
    assert_eq!(before.plans()[ROUTE].key, after.plans()[ROUTE].key);
    let paths = BTreeMap::from([("home".into(), "Home".into())]);
    let preparation = Preparation {
        before,
        after: &after,
        paths: &paths,
        transparent: &Default::default(),
        paths_preserved,
        recording: None,
        probes: None,
    };
    let ViewInput::Ready(prepared) = preparation
        .retained(Some(ROUTE), Some(after_route), moved)
        .unwrap()
    else {
        panic!("a retained view must prepare without source reads")
    };
    (*prepared, restores.load(Ordering::SeqCst))
}
