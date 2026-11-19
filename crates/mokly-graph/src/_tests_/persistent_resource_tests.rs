//! Equal stored compositions still use each side's resource policy and observations.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use crate::cache::{Artifact, MemoryCache};
use crate::collection::ComparisonCollectorMock;
use crate::document_store::{DocumentStoreMock, Persistence, ReadOutcome};
use crate::error::GraphError;
use crate::graph::Graph;
use crate::policy::{PublicFile, PublicPolicyMock};
use crate::public_denial::PublicDenial;
use crate::resource_inputs::MemoryResourceInputs;
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;
use crate::types::RenderGeneration;
use crate::workers::RenderWorkersMock;

use super::{collection_support, persistent_session_tests};

fn side(allowed: bool) -> (Session, Arc<Artifact>) {
    let baseline = collection_support::probe(1);
    baseline.session.render_all().unwrap();
    let mut collector = Unimock::new(
        ComparisonCollectorMock::collect
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(())),
    );
    baseline.session.collect_comparison(&mut collector).unwrap();
    let original = &baseline.session.state;
    let mut saved = (*persistent_session_tests::artifact()).clone();
    saved
        .document
        .as_mut()
        .unwrap()
        .resources
        .push("asset.css".into());
    let saved = Arc::new(saved);
    let source = Arc::new(if allowed {
        Unimock::new((
            SourceTreeMock::project
                .each_call(matching!(_))
                .answers(&|_, _| {
                    Ok(Some(Node {
                        identity: "/repo/asset.css".into(),
                        lexical_kind: FileKind::File,
                        kind: FileKind::File,
                    }))
                }),
            SourceTreeMock::digest
                .each_call(matching!(_))
                .answers(&|_, _| Ok("current-side-css".into())),
            SourceTreeMock::read_public
                .some_call(matching!(_))
                .returns(Ok(b"body{color:green}".to_vec())),
        ))
    } else {
        Unimock::new((
            SourceTreeMock::project
                .some_call(matching!(_))
                .returns(Ok(Some(Node {
                    identity: "/repo/asset.css".into(),
                    lexical_kind: FileKind::File,
                    kind: FileKind::File,
                }))),
            SourceTreeMock::digest
                .some_call(matching!(_))
                .answers(&|_, _| Ok("current-side-css".into())),
        ))
    });
    let policy = Arc::new(Unimock::new(
        PublicPolicyMock::check
            .each_call(matching!("asset.css"))
            .answers_arc(Arc::new(move |_, _| {
                if allowed {
                    Ok(PublicFile {
                        path: "asset.css".into(),
                        absolute: "/repo/asset.css".into(),
                    })
                } else {
                    Err(PublicDenial::Private)
                }
            })),
    ));
    let value = saved.clone();
    let mut inputs = original.inputs.clone();
    inputs.resources = Arc::new(MemoryResourceInputs::default());
    inputs.persistence = Some(Persistence {
        javascript: None,
        store: Arc::new(Unimock::new((
            DocumentStoreMock::identity
                .some_call(matching!())
                .returns(Some("same-build".into())),
            DocumentStoreMock::load
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| ReadOutcome::Hit(value.clone()))),
        ))),
    });
    let graph = Graph {
        inputs,
        tree: source,
        composer: Arc::new(Unimock::new(())),
        stylesheets: original.stylesheets.clone(),
        cache: Arc::new(MemoryCache::new(1024 * 1024, 0)),
        workers: Arc::new(Unimock::new(
            RenderWorkersMock::document
                .some_call(matching!(_, _))
                .answers(&|_, route, worker| worker.artifact(route)),
        )),
        version: "test".into(),
    };
    let session = Session::new(
        &graph,
        SessionInput {
            config: original.config.as_ref().clone(),
            catalogue: original.catalogue.as_ref().clone(),
            plans: original.plans.as_ref().clone(),
            resources: BTreeMap::new(),
            policy,
            generation_key: "current-side".into(),
            matchers: Matchers::new(&original.config).unwrap(),
            directories: vec![],
        },
    );
    (session, saved)
}

#[test]
fn stored_views_rebuild_current_resource_evidence_and_add_only_current_closure_warnings() {
    let (session, saved) = side(true);
    let actual = session.render("page-000/index.html").unwrap();
    assert_eq!(actual.bytes, saved.bytes);
    let document = actual.document.as_ref().unwrap();
    assert_eq!(document.usage, saved.document.as_ref().unwrap().usage);
    assert_eq!(
        document
            .warnings
            .iter()
            .map(|warning| warning.code)
            .collect::<Vec<_>>(),
        ["base-dependencies", "stylesheet-owner"]
    );
    assert_eq!(session.public_files(), BTreeSet::from(["asset.css".into()]));
    assert_eq!(saved.document.as_ref().unwrap().warnings.len(), 1);
    assert_eq!(session.watch_files(), BTreeSet::from(["asset.css".into()]));
    assert_eq!(
        session
            .state
            .inputs
            .resources
            .paths("page-000/index.html")
            .get("asset.css"),
        Some(&Some("current-side-css".into()))
    );
}

#[test]
fn stored_views_still_fail_current_side_public_resource_policy() {
    let (session, _) = side(false);
    let rendered = session.render("page-000/index.html");
    assert!(
        matches!(rendered, Err(GraphError::Attempt { .. })),
        "stored reads must repeat current-side public policy"
    );
    let Err(GraphError::Attempt { failures, .. }) = rendered else {
        panic!("current-side policy must reject the stored resource")
    };
    assert!(
        failures[0]
            .to_string()
            .contains("private package or output tree")
    );
    assert_eq!(session.public_files(), BTreeSet::new());
    assert_eq!(session.watch_files(), BTreeSet::from(["asset.css".into()]));
}
