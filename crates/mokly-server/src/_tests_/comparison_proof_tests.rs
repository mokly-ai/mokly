//! Reuse proofs preserve frozen byte checks and source-free base admission.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_graph::cache::Artifact;
use mokly_graph::comparison_proof::{ComparisonRead, ContentIdentity, ProofMode, content_identity};
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_html::composition::Composed;
use mokly_model::material::digest;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_graph::FrozenResources;

#[test]
fn retained_resource_proofs_read_only_known_digests_and_current_proofs_reject_mutation() {
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new(
        RenderGenerationMock::resource_digest.stub(|each| {
            each.call(matching!("static/theme.css"))
                .answers(&|_, _| Ok(Some(digest(b"before"))))
                .once()
                .then()
                .answers(&|_, _| Ok(Some(digest(b"after"))))
                .once();
        }),
    )));
    assert_eq!(
        graph.comparison_identity(
            ComparisonRead::Resource,
            "static/theme.css",
            ProofMode::Retained
        ),
        None
    );
    assert_eq!(
        graph.resource_digest("static/theme.css").unwrap(),
        Some(digest(b"before"))
    );
    assert_eq!(
        graph.comparison_identity(
            ComparisonRead::Resource,
            "static/theme.css",
            ProofMode::Retained
        ),
        Some(content_identity(
            &serde_json::to_vec(&Some(digest(b"before"))).unwrap()
        ))
    );
    assert_eq!(
        graph.comparison_identity(
            ComparisonRead::Resource,
            "static/theme.css",
            ProofMode::Current
        ),
        None
    );
    let original = document_proof(b"ignore boundary present");
    assert_eq!(document_proof(b"ignore boundary present"), original);
    assert_ne!(document_proof(b"ignore boundary removed"), original);
}

fn document_proof(recipe: &[u8]) -> ContentIdentity {
    let generation: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new((
        RenderGenerationMock::comparison_document
            .some_call(matching!("same/index.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: b"<p>unchanged delivered HTML</p>".to_vec(),
                content_type: "text/html".into(),
                document: None,
                fragment: None,
            }))),
        RenderGenerationMock::comparison_identity
            .some_call(matching!(
                ComparisonRead::Document,
                "same/index.html",
                ProofMode::Current
            ))
            .returns(Some(content_identity(recipe))),
    ))));
    generation
        .comparison_identity(
            ComparisonRead::Document,
            "same/index.html",
            ProofMode::Current,
        )
        .unwrap()
}

#[test]
fn checked_head_proof_uses_one_checked_artifact_for_current_usage_and_recording() {
    let reads = Arc::new(AtomicUsize::new(0));
    let counter = reads.clone();
    let graph: &dyn RenderGeneration = &FrozenResources::new(Arc::new(Unimock::new((
        RenderGenerationMock::comparison_document
            .each_call(matching!("current/index.html"))
            .answers_arc(Arc::new(move |_, _| {
                counter.fetch_add(1, Ordering::SeqCst);
                Ok(Arc::new(Artifact {
                    bytes: b"current checked HTML".to_vec(),
                    content_type: "text/html".into(),
                    fragment: None,
                    document: Some(Composed {
                        tree: vec![],
                        usage: CatalogueUsage::Unavailable,
                        warnings: vec![],
                        resources: vec![],
                        components: vec![],
                        links: vec![],
                    }),
                }))
            })),
        RenderGenerationMock::comparison_identity
            .each_call(matching!(ComparisonRead::Document, "current/index.html", _))
            .returns(Some(content_identity(b"current recipe"))),
    ))));
    let proof = graph
        .comparison_document_proof("current/index.html")
        .unwrap();
    assert_eq!(proof.usage, Some(CatalogueUsage::Unavailable));
    assert_eq!(
        graph.comparison_identity(
            ComparisonRead::Document,
            "current/index.html",
            ProofMode::Retained
        ),
        Some(proof.identity)
    );
    assert_eq!(reads.load(Ordering::SeqCst), 1);
}
