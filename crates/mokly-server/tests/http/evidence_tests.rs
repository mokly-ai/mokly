//! Real graph completions replace fenced details and prove component consumers.

use std::sync::Arc;
use std::time::Duration;

use mokly_model::detail_context;
use mokly_model::readers;
use mokly_model::usage::CatalogueUsage;
use mokly_server::background::{Background, UsagePass};
use mokly_server::diagnostics::TracingDiagnostics;
use mokly_server::publication::{PublicationWriter, Publications};
use mokly_server::snapshot::{Projector, Snapshot, SnapshotFactory, SnapshotInput};
use mokly_server::work::Workers;
use tokio::sync::watch;

use super::support;

#[tokio::test]
async fn on_demand_usage_and_the_background_pass_publish_complete_consumers_once() {
    let harness = support::Harness::with_edit(|root| {
        let path = root.join("specs/components/card.component.html");
        let body = std::fs::read_to_string(&path).unwrap();
        std::fs::write(
            path,
            body + "\n<ui-button mokly-instance=\"nested\" label=\"Nested\"></ui-button>\n",
        )
        .unwrap();
    })
    .await;
    assert!(harness.snapshot.completed.is_empty());
    assert!(
        harness
            .snapshot
            .details
            .values()
            .all(|detail| detail.workspace.is_none())
    );
    let mut stream = harness
        .client
        .get(format!("{}/mokly-viewer/events", harness.url))
        .send()
        .await
        .unwrap();
    assert!(String::from_utf8_lossy(&stream.chunk().await.unwrap().unwrap()).contains("id: 1\n"));
    let route = "home/index.mobile.html";
    let response = harness
        .client
        .get(format!("{}/static/mokly-generated/{route}", harness.url))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert!(String::from_utf8_lossy(&stream.chunk().await.unwrap().unwrap()).contains("id: 2\n"));
    let current = harness.publications.current();
    assert_eq!(current.index.revision, 2);
    assert!(matches!(
        current.details["home"].views[0].usage,
        CatalogueUsage::Ready { .. }
    ));
    assert!(current.details["components/button"].workspace.is_none());
    assert_eq!(
        current.index.screens[0].visual.views[0].document_key,
        harness.snapshot.index.screens[0].visual.views[0].document_key
    );
    let (stop, receiver) = watch::channel(false);
    let pass = UsagePass {
        changes: None,
        publications: harness.publications.clone(),
        work: Arc::new(Workers::new(2, Arc::new(TracingDiagnostics))),
        diagnostics: Arc::new(TracingDiagnostics),
    };
    let mut updates = harness.publications.subscribe().updates;
    let task = tokio::spawn(async move {
        pass.run(receiver).await;
    });
    let completed = tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let current = harness.publications.current();
            if current.completed.len() == current.views.len() {
                break current;
            }
            updates.recv().await.unwrap();
        }
    })
    .await
    .unwrap();
    assert_eq!(completed.index.revision, 3);
    for path in completed.details.keys() {
        detail_context::validate(&completed.detail(path).unwrap(), &completed.index).unwrap();
    }
    let used = &completed.details["components/button"]
        .workspace
        .as_ref()
        .unwrap()
        .used_by;
    assert!(
        used.iter()
            .any(|link| link.entry_path == "home" && link.direct)
    );
    assert!(
        used.iter()
            .any(|link| link.entry_path == "home" && !link.direct)
    );
    assert!(
        !used
            .iter()
            .any(|link| link.entry_path == "components/button")
    );
    assert!(
        completed
            .details
            .values()
            .flat_map(|detail| &detail.views)
            .all(|view| matches!(view.usage, CatalogueUsage::Ready { .. }))
    );
    harness
        .client
        .get(format!("{}/static/mokly-generated/{route}", harness.url))
        .send()
        .await
        .unwrap();
    assert_eq!(
        harness.publications.current().index.revision,
        completed.index.revision
    );
    stop.send_replace(true);
    task.await.unwrap();
    harness.close().await;
}

#[tokio::test]
async fn served_index_lists_the_id_of_a_completed_detail() {
    let harness = support::Harness::new().await;
    let response = harness
        .client
        .get(format!(
            "{}/static/mokly-generated/home/index.mobile.html",
            harness.url
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let detail = readers::detail(
        &harness
            .client
            .get(format!("{}/mokly-viewer/entries/home.json", harness.url))
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap(),
    )
    .unwrap();
    let index = readers::index(
        &harness
            .client
            .get(format!("{}/mokly-viewer/index.json", harness.url))
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(detail.revision, Some(index.revision));
    assert_eq!(
        index
            .screens
            .iter()
            .find(|entry| entry.entry.path == "home")
            .unwrap()
            .entry
            .detail_id,
        detail.detail_id
    );
    harness.close().await;
}

#[tokio::test]
async fn failed_renders_publish_unavailable_usage_without_inventing_consumer_lists() {
    let harness = support::Harness::with_edit(|root| {
        std::fs::write(root.join("specs/home.screen.html"), "---\ntitle: Home\nprops: {target: missing}\n---\n<h1 id=\"home\">Home</h1><a href=\"mock:{{target}}\">Go</a>").unwrap();
    }).await;
    let response = harness
        .client
        .get(format!(
            "{}/static/mokly-generated/home/index.mobile.html",
            harness.url
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 500);
    let current = wait_revision(&harness, 2).await;
    assert_eq!(current.index.revision, 2);
    assert!(matches!(
        current.details["home"].views[0].usage,
        CatalogueUsage::Unavailable
    ));
    assert!(current.details["components/button"].workspace.is_none());
    let response = harness
        .client
        .get(format!(
            "{}/static/mokly-generated/components/button/index.mobile.html",
            harness.url
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let current = wait_revision(&harness, 3).await;
    assert_eq!(current.index.revision, 3);
    assert!(matches!(
        current.details["components/button"].views[0].usage,
        CatalogueUsage::Ready { .. }
    ));
    assert!(current.details["components/button"].workspace.is_none());
    harness.close().await;
}

#[tokio::test]
async fn a_completion_from_a_replaced_backend_cannot_publish_even_when_keys_match() {
    let harness = support::Harness::new().await;
    let replacement = support::Harness::new().await;
    let projector = Projector {
        deployment_id: harness.snapshot.index.deployment_id.clone(),
        render_token: harness.snapshot.render_token.clone(),
    };
    let next = projector
        .create(
            replacement.generation.clone(),
            SnapshotInput {
                documents: replacement.snapshot.documents.clone(),
                revision: 2,
                config_path: "mokly.config.json".into(),
                base: None,
                assets: Default::default(),
            },
        )
        .unwrap();
    assert_eq!(
        next.index.live.as_ref().unwrap().generation,
        harness.snapshot.index.live.as_ref().unwrap().generation
    );
    assert!(harness.publications.replace(next));
    harness
        .snapshot
        .documents
        .background("home/index.mobile.html")
        .unwrap();
    harness
        .publications
        .completed(&harness.snapshot, "home/index.mobile.html")
        .unwrap();
    let current = harness.publications.current();
    assert_eq!(current.index.revision, 2);
    assert!(current.completed.is_empty());
    replacement.close().await;
    harness.close().await;
}

async fn wait_revision(harness: &support::Harness, revision: u64) -> Arc<Snapshot> {
    tokio::time::timeout(Duration::from_secs(15), async {
        let mut updates = harness.publications.subscribe().updates;
        loop {
            let current = harness.publications.current();
            if current.index.revision >= revision {
                return current;
            }
            updates.recv().await.unwrap();
        }
    })
    .await
    .unwrap()
}

#[tokio::test]
async fn page_and_markdown_document_responses_do_not_raise_the_revision() {
    let harness = support::Harness::new().await;
    for route in ["page/index.html", "guide/index.html"] {
        let response = harness
            .client
            .get(format!("{}/static/mokly-generated/{route}", harness.url))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        assert!(!response.bytes().await.unwrap().is_empty());
    }
    assert_eq!(harness.publications.current().index.revision, 1);
    assert!(harness.publications.current().completed.is_empty());
    harness.close().await;
}
