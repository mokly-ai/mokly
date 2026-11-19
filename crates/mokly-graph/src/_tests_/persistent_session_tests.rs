//! Stored compositions repeat current-side validation and never become fresh writes.

use std::sync::{Arc, Mutex};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::links::Reference;
use mokly_html::{parse, tree};
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::cache::{Artifact, MemoryCache};
use crate::collection::ComparisonCollectorMock;
use crate::document_store::{
    DocumentStore, DocumentStoreMock, OfferOutcome, Persistence, ReadOutcome,
};
use crate::error::{GraphError, invalid};
use crate::public_inputs::MemoryClosureInputs;
use crate::types::RenderGeneration;

use super::collection_support;
use crate::session::Session;

pub(super) fn artifact() -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: b"exact saved bytes\0\xff".to_vec(),
        content_type: "text/html; charset=utf-8".into(),
        fragment: None,
        document: Some(mokly_html::composition::Composed {
            tree: vec![tree::Node::Region {
                region: mokly_html::tree::Region {
                    id: "private".into(),
                    kind: mokly_html::tree::RegionKind::Root {
                        path: "card".into(),
                    },
                },
                children: parse::html(DeliveredHtml::fragment("<p id=anchor>Stored</p>")),
            }],
            usage: CatalogueUsage::Ready {
                instances: vec![],
                slots: vec![],
                ranges: vec![],
            },
            resources: vec![],
            components: vec!["card".into()],
            warnings: vec![collection_support::warning("stored")],
            links: vec![],
        }),
    })
}

pub(super) fn install(
    session: &mut Session,
    saved: Option<Arc<Artifact>>,
    offers: Arc<Mutex<Vec<String>>>,
) {
    let store: Arc<dyn DocumentStore> = if let Some(saved) = saved {
        Arc::new(Unimock::new((
            DocumentStoreMock::identity
                .each_call(matching!())
                .returns(Some("native-build".into())),
            DocumentStoreMock::load
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| ReadOutcome::Hit(saved.clone()))),
        )))
    } else {
        Arc::new(Unimock::new((
            DocumentStoreMock::identity
                .each_call(matching!())
                .returns(Some("native-build".into()))
                .at_least_times(0),
            DocumentStoreMock::load
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| ReadOutcome::Miss))
                .at_least_times(0),
            DocumentStoreMock::offer
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, key| {
                    offers.lock().unwrap().push(key.0.clone());
                    OfferOutcome::Queued
                }))
                .at_least_times(0),
        )))
    };
    Arc::get_mut(&mut session.state).unwrap().inputs.persistence = Some(Persistence {
        store,
        javascript: None,
    });
}

#[test]
fn a_stored_document_keeps_bytes_usage_and_private_annotations_without_composition_or_offers() {
    let mut probe = collection_support::probe(1);
    probe.session.render_all().unwrap();
    let mut baseline = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(())),
    );
    probe.session.collect_comparison(&mut baseline).unwrap();
    probe.renders.lock().unwrap().clear();
    let saved = artifact();
    let offers = Arc::new(Mutex::new(Vec::new()));
    install(&mut probe.session, Some(saved.clone()), offers.clone());
    let actual = probe
        .session
        .comparison_document("page-000/index.html")
        .unwrap();
    assert_eq!(actual.bytes, saved.bytes);
    assert_eq!(actual.content_type, saved.content_type);
    let before = saved.document.as_ref().unwrap();
    let after = actual.document.as_ref().unwrap();
    assert_eq!(after.tree, before.tree);
    assert_eq!(after.usage, before.usage);
    assert_eq!(after.components, before.components);
    assert_eq!(after.warnings, before.warnings);
    let mut collector = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(())),
    );
    probe.session.collect_comparison(&mut collector).unwrap();
    assert_eq!(*probe.renders.lock().unwrap(), Vec::<String>::new());
    assert_eq!(*offers.lock().unwrap(), Vec::<String>::new());
}

#[test]
fn stored_logical_links_still_fail_against_the_current_destination() {
    let mut probe = collection_support::probe(1);
    probe.session.render_all().unwrap();
    let mut baseline = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(())),
    );
    probe.session.collect_comparison(&mut baseline).unwrap();
    probe.renders.lock().unwrap().clear();
    let mut saved = (*artifact()).clone();
    saved.document.as_mut().unwrap().links.push(Reference {
        source_route: "page-000/index.html".into(),
        target: "page-000".into(),
        fragment: Some("missing".into()),
    });
    install(
        &mut probe.session,
        Some(Arc::new(saved)),
        Arc::new(Mutex::new(Vec::new())),
    );
    let error = probe.session.comparison_document("page-000/index.html");
    assert!(
        matches!(error, Err(GraphError::Invalid { ref message, .. }) if message.contains("logical fragment \"missing\" is missing"))
    );
    assert_eq!(*probe.renders.lock().unwrap(), Vec::<String>::new());
}

#[test]
fn fresh_documents_are_offered_once_after_complete_collection_validation() {
    let mut probe = collection_support::probe_with_cache(
        4,
        Arc::new(MemoryClosureInputs::default()),
        Some(Arc::new(MemoryCache::new(1024 * 1024, 0))),
    );
    let offers = Arc::new(Mutex::new(Vec::new()));
    install(&mut probe.session, None, offers.clone());
    let pending = offers.clone();
    let mut failed = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Err(invalid("collector", "failed"))),
    );
    assert!(matches!(
        probe.session.collect_comparison(&mut failed),
        Err(GraphError::Invalid { .. })
    ));
    assert_eq!(*offers.lock().unwrap(), Vec::<String>::new());
    let mut collector = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                assert_eq!(*pending.lock().unwrap(), Vec::<String>::new());
                Ok(())
            })),
    );
    probe.session.collect_comparison(&mut collector).unwrap();
    assert_eq!(
        *offers.lock().unwrap(),
        [
            "page-000/index.html",
            "page-001/index.html",
            "page-002/index.html",
            "page-003/index.html"
        ]
    );
    probe.session.render_all().unwrap();
    assert_eq!(offers.lock().unwrap().len(), 4);
    assert_eq!(probe.renders.lock().unwrap().len(), 4);
}
