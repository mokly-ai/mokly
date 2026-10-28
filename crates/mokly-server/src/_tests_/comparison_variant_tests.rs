//! Selected variant delivery retains its evidence owner without capturing siblings.

use std::sync::Arc;

use axum::body::to_bytes;
use axum::http::{StatusCode, Uri};
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::axes::EntryKind;
use mokly_model::evidence::{EvidenceOwner, RuleEvidence, RuleStatus};
use mokly_model::readers;
use mokly_model::review::{EntryChangeReason, ReviewEntry, ReviewKind};
use unimock::{MockFn, Unimock, matching};

use crate::application::Application;
use crate::changes::Accepted;
use crate::clock::ClockMock;
use crate::comparison_capture::SnapshotCapture;
use crate::comparison_routes;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, snapshot};
use crate::entropy::EntropyMock;
use crate::publication::SharedPublication;

const PARENT: &str = "components/card";
const VARIANT: &str = "components/card/featured";
const DOCUMENT: &str = "components/card/featured/index.mobile.html";

fn graph(bytes: &'static [u8]) -> Unimock {
    Unimock::new((
        RenderGenerationMock::render
            .next_call(matching!("components/card/featured/index.mobile.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: bytes.into(),
                document: None,
                fragment: None,
                content_type: "text/html".into(),
            }))),
        RenderGenerationMock::closure
            .next_call(matching!("components/card/featured/index.mobile.html"))
            .returns(Ok(Closure::default())),
    ))
}

fn address(entry: &mut ReviewEntry, path: &str, title: &str) {
    entry.path = path.into();
    entry.title = title.into();
    for side in [&mut entry.before, &mut entry.after].into_iter().flatten() {
        side.path = path.into();
        side.title = title.into();
        side.supplied_slots = Some(vec![]);
    }
}

fn family(before: Arc<dyn RenderGeneration>, after: Arc<dyn RenderGeneration>) -> Arc<Accepted> {
    let mut input = accepted(before, after);
    let result = &mut Arc::get_mut(&mut input).unwrap().result;
    let parent = &mut result.review.entries[0];
    parent.kind = ReviewKind::Component;
    address(parent, PARENT, "Card");
    parent.reasons = vec![EntryChangeReason::Dependency {
        path: "static/theme.css".into(),
    }];
    parent.views[0].rules = vec![RuleEvidence {
        stylesheet: "static/theme.css".into(),
        selector: ".accent".into(),
        status: RuleStatus::Matched,
        owner: EvidenceOwner::Component {
            path: PARENT.into(),
        },
    }];
    let mut variant = parent.clone();
    address(&mut variant, VARIANT, "Featured");
    let mut sibling = parent.clone();
    address(&mut sibling, "components/card/fresh", "Fresh");
    parent.variants = Some(vec![variant, sibling]);
    let template = result.entries[0].clone();
    result.entries = [PARENT, VARIANT, "components/card/fresh"]
        .map(|path| {
            let mut entry = template.clone();
            entry.kind = EntryKind::Component;
            entry.path = path.into();
            entry.reasons = parent.reasons.clone();
            entry.documents[0].evidence.rules = parent.views[0].rules.clone();
            entry.documents[0].before_route = Some(format!("{path}/index.mobile.html"));
            entry.documents[0].after_route = Some(format!("{path}/index.mobile.html"));
            entry
        })
        .to_vec();
    readers::review(&serde_json::to_string(&result.review).unwrap()).unwrap();
    input
}

#[tokio::test]
async fn selected_variant_with_parent_owned_rules_redirects_and_captures_only_variant_documents() {
    let before = graph(b"<h2>Featured Before</h2>");
    let after = graph(b"<h2>Featured After</h2>");
    let input = family(Arc::new(before.clone()), Arc::new(after.clone()));
    let publications = Arc::new(SharedPublication::new(snapshot(Some(input))));
    let diagnostics = Unimock::new(());
    let store = Arc::new(MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds
                .each_call(matching!())
                .returns(0_u64),
        )),
        Arc::new(Unimock::new(
            EntropyMock::secret
                .each_call(matching!())
                .returns("c".repeat(64))
                .at_least_times(0),
        )),
        Arc::new(SnapshotCapture),
        publications.clone(),
        Arc::new(diagnostics.clone()),
    ));
    let mut app = Application::new(
        publications,
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(diagnostics.clone()),
    );
    app.comparisons = Some(store.clone());
    let path = "mokly-viewer/diffs/selection";
    let uri: Uri = format!("/{path}?path={VARIANT}").parse().unwrap();
    let response = comparison_routes::route(&app, path, &uri).await.unwrap();
    let status = response.status();
    let location = response.headers().get("location").cloned();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(status, StatusCode::FOUND, "{body:?}");
    assert!(body.is_empty());
    let uri: Uri = location.unwrap().to_str().unwrap().parse().unwrap();
    assert!(uri.path().ends_with('/'));
    let response = comparison_routes::route(&app, uri.path().trim_start_matches('/'), &uri)
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    let generation = uri.path().split('/').nth(4).unwrap();
    assert!(
        store
            .file(generation, "review.json")
            .await
            .unwrap()
            .is_none()
    );
    for (side, expected) in [("before", "Featured Before"), ("after", "Featured After")] {
        let file = store
            .file(
                generation,
                &format!("snapshots/{side}/mokly-generated/{DOCUMENT}"),
            )
            .await
            .unwrap()
            .unwrap();
        assert_eq!(file.bytes, format!("<h2>{expected}</h2>"));
        for excluded in [PARENT, "components/card/fresh"] {
            assert!(
                store
                    .file(
                        generation,
                        &format!("snapshots/{side}/mokly-generated/{excluded}/index.mobile.html")
                    )
                    .await
                    .unwrap()
                    .is_none()
            );
        }
    }
    store.stop().await;
    app.publisher.close().await;
}
