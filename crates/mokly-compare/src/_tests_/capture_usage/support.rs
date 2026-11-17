//! Captured generations with counted restores and literal component input fixtures.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_error::Result;
use mokly_graph::types::{RenderGeneration, RenderSummary};
use mokly_html::composition::Composed;
use mokly_model::usage::{CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord};
use mokly_model::wire_props::{ComponentWireValue, StringTag};

use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::DocumentRestorer;
use crate::comparison_capture::CapturedView;

pub(super) const ROUTE: &str = "home/empty/index.desktop.html";

struct CountedRestorer(Arc<AtomicUsize>);

impl DocumentRestorer for CountedRestorer {
    fn restore(&self, view: &EncodedView) -> Result<Artifact> {
        self.0.fetch_add(1, Ordering::SeqCst);
        view.restore()
    }
}

pub(super) fn captured(
    source: Arc<dyn RenderGeneration>,
    views: Vec<(&str, Option<CatalogueUsage>)>,
    restores: Arc<AtomicUsize>,
) -> Arc<dyn RenderGeneration> {
    Arc::new(CapturedGeneration {
        source,
        views: views
            .into_iter()
            .map(|(route, usage)| {
                let artifact = Artifact {
                    bytes: b"captured document".to_vec(),
                    content_type: "text/html".into(),
                    fragment: None,
                    document: usage.map(|usage| Composed {
                        tree: vec![],
                        usage,
                        warnings: vec![],
                        resources: vec![],
                        components: vec![],
                        links: vec![],
                    }),
                };
                (
                    route.into(),
                    CapturedView {
                        document: EncodedView::encode(&artifact).unwrap(),
                        closure: Closure::default(),
                    },
                )
            })
            .collect(),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(CountedRestorer(restores)),
    })
}

pub(super) fn usage(instances: Vec<ComponentInstanceRecord>) -> CatalogueUsage {
    CatalogueUsage::Ready {
        instances,
        slots: vec![],
        ranges: vec![],
    }
}

pub(super) fn instance(id: &str, component: &str, label: &str) -> ComponentInstanceRecord {
    ComponentInstanceRecord {
        key: id.into(),
        id: id.into(),
        component_id: component.into(),
        owner: ComponentInputOwner::Entry,
        slot_key: None,
        order: 0,
        props: BTreeMap::from([(
            "label".into(),
            ComponentWireValue::String(StringTag::Value, label.into()),
        )]),
        props_key: label.into(),
        source: None,
    }
}
