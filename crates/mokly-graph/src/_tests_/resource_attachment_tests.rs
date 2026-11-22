//! A controlled edit at attachment cannot leave a pre-attachment resource digest.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::parse;
use mokly_model::usage::CatalogueUsage;
use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::collection::ComparisonCollectorMock;
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::resource_inputs::{
    MemoryResourceInputs, ResourceInputs, ResourceObserver, ResourceObserverMock,
};
use crate::types::RenderGeneration;
use crate::workers::RenderWorkersMock;

use super::collection_support;

#[test]
fn an_edit_at_resource_attachment_precedes_prefetch_and_the_first_digest() {
    let mut probe = collection_support::probe(1);
    probe.session.render_all().unwrap();
    let mut collector = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(())),
    );
    probe.session.collect_comparison(&mut collector).unwrap();
    let edited = Arc::new(AtomicBool::new(false));
    let prefetched = Arc::new(Mutex::new(None));
    let evidence = Arc::new(MemoryResourceInputs::default());
    let state = Arc::get_mut(&mut probe.session.state).unwrap();
    state.inputs.resources.release("page-000/index.html");
    evidence.retain("page-000/index.html");
    state.inputs.resources = evidence.clone();
    state.composer = Arc::new(Unimock::new(
        ComposerMock::compose.some_call(matching!(_)).answers(&|_, _| {
            Ok(Composed {
                tree: parse::html(DeliveredHtml::document(
                    "<html><head><link rel=stylesheet href='../../asset.css'></head><body></body></html>",
                )),
                usage: CatalogueUsage::Unavailable,
                resources: vec![], components: vec![], warnings: vec![], links: vec![],
            })
        }),
    ));
    state.workers = Arc::new(Unimock::new(
        RenderWorkersMock::document
            .some_call(matching!(_, _))
            .answers(&|_, route, worker| worker.artifact(route)),
    ));
    state.policy = Arc::new(Unimock::new(
        PublicPolicyMock::check
            .each_call(matching!("asset.css"))
            .answers(&|_, _| {
                Ok(PublicFile {
                    path: "asset.css".into(),
                    absolute: "/repo/asset.css".into(),
                })
            }),
    ));
    state.tree = Arc::new(Unimock::new((
        SourceTreeMock::project
            .each_call(matching!(_))
            .answers(&|_, path| {
                Ok(Some(Node {
                    identity: path.into(),
                    kind: FileKind::File,
                    lexical_kind: FileKind::File,
                }))
            }),
        SourceTreeMock::prefetch
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let edited = edited.clone();
                let prefetched = prefetched.clone();
                move |_, _| {
                    *prefetched.lock().unwrap() = Some(edited.load(Ordering::SeqCst));
                    Ok(())
                }
            })),
        SourceTreeMock::digest
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let edited = edited.clone();
                let prefetched = prefetched.clone();
                move |_, _| {
                    let current = prefetched
                        .lock()
                        .unwrap()
                        .unwrap_or_else(|| edited.load(Ordering::SeqCst));
                    Ok(if current { "after-edit" } else { "before-edit" }.into())
                }
            })),
        SourceTreeMock::read_public
            .some_call(matching!(_))
            .returns(Ok(b"body{}".to_vec())),
    )));
    let observer: Arc<dyn ResourceObserver> = Arc::new(Unimock::new(
        ResourceObserverMock::observe
            .some_call(matching!("test", "asset.css"))
            .answers_arc(Arc::new(move |_, _, _| {
                edited.store(true, Ordering::SeqCst);
                Ok(())
            })),
    ));
    probe.session.observe_resources(Arc::downgrade(&observer));

    probe.session.render("page-000/index.html").unwrap();

    assert_eq!(
        evidence.paths("page-000/index.html"),
        BTreeMap::from([("asset.css".into(), Some("after-edit".into()))]),
        "the first resource baseline must include the edit made at attachment",
    );
    assert_eq!(
        *prefetched.lock().unwrap(),
        Some(true),
        "prefetch must follow attachment"
    );
}
