//! Publications that share unchanged details publish the bytes of a full rebuild.

use std::collections::BTreeMap;
use std::sync::Arc;

use axum::body::to_bytes;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_types::{Comparison, ComparisonRequest};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::types::RenderGeneration;
use mokly_model::catalogue::EntryContent;
use mokly_model::material::digest;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::usage::CatalogueUsage;
use unimock::Unimock;

use crate::changes::{self, Accepted, ChangeToken};
use crate::detail_encoding::EncodedDetails;
use crate::evidence;
use crate::snapshot::{Projector, Snapshot, SnapshotFactory, SnapshotInput};

use super::fixture::Fixture;
use super::reference;

/// One publication of each chain: the product's, then the reference full rebuild's.
type Chains = [Arc<Snapshot>; 2];

#[tokio::test]
async fn shared_details_publish_the_bytes_of_a_full_rebuild_after_each_edit() {
    let base = Fixture::default();
    let before = base.published_generation(false);
    let mut fixture = base.clone();
    let mut chains: Option<Chains> = None;
    for scenario in [
        "initial",
        "screen",
        "metadata",
        "ignored-content",
        "component",
        "binding",
        "controls",
        "added-entry",
        "removed-entry",
        "revert",
    ] {
        edit(&mut fixture, &base, scenario);
        let after = fixture.published_generation(true);
        let accepted = accepted(scenario, before.clone(), after.clone());
        let mut current = rebuild(chains.take(), after.clone());
        same(&current, scenario, "rebuild").await;
        let updates = usage(after.as_ref());
        let (first, settled) = updates.split_at(updates.len() / 2);
        for (phase, step) in [
            ("preparing", Step::Status(ChangesStatus::Preparing)),
            ("first usage", Step::Usage(first)),
            ("pending", Step::Status(ChangesStatus::Pending)),
            ("settled usage", Step::Usage(settled)),
            ("ready", Step::Ready(&accepted)),
            ("unavailable", Step::Status(ChangesStatus::Unavailable)),
        ] {
            current = publish(current, &step);
            same(&current, scenario, phase).await;
        }
        chains = Some(current);
    }
}

/// Each edit changes the inputs of some details and leaves the others equal.
fn edit(fixture: &mut Fixture, base: &Fixture, scenario: &str) {
    match scenario {
        "screen" => {
            fixture
                .html
                .insert("one".into(), "<p>edited module</p>".into());
        }
        "metadata" => fixture.entries[0].metadata.title = "New screen title".into(),
        "ignored-content" => fixture.ignored = "clock two".into(),
        "component" => {
            fixture
                .html
                .insert("badge".into(), "<p class=card>Edited</p>".into());
        }
        "binding" => fixture.label = "New binding title".into(),
        "controls" => {
            if let EntryContent::Screen { visual, .. } = &mut fixture.entries[1].content {
                visual.control_order = vec!["label".into()];
            }
        }
        "added-entry" => {
            let mut entry = fixture.entries[0].clone();
            entry.metadata.path = "three".into();
            fixture.entries.push(entry);
            fixture
                .html
                .insert("three".into(), "<p>new screen</p>".into());
        }
        "removed-entry" => fixture.entries.retain(|entry| entry.metadata.path != "two"),
        "revert" => *fixture = base.clone(),
        _ => {}
    }
}

enum Step<'a> {
    Usage(&'a [(String, CatalogueUsage)]),
    Status(ChangesStatus),
    Ready(&'a Arc<Accepted>),
}

fn publish([product, full]: Chains, step: &Step<'_>) -> Chains {
    match step {
        Step::Usage(updates) => [
            evidence::complete(&product, updates, &EncodedDetails)
                .unwrap()
                .unwrap_or(product),
            reference::complete(&full, updates).unwrap().unwrap_or(full),
        ],
        Step::Status(status) => [
            changes::project(&product, *status, None, &EncodedDetails).unwrap(),
            reference::project(&full, *status, None).unwrap(),
        ],
        Step::Ready(accepted) => [
            changes::project(
                &product,
                ChangesStatus::Ready,
                Some((*accepted).clone()),
                &EncodedDetails,
            )
            .unwrap(),
            reference::project(&full, ChangesStatus::Ready, Some((*accepted).clone())).unwrap(),
        ],
    }
}

/// Assert equal raw bytes of every published file, and equal typed details and completions.
async fn same([product, full]: &Chains, scenario: &str, phase: &str) {
    assert_eq!(
        product.index.revision, full.index.revision,
        "{scenario}, {phase}: revision"
    );
    assert_eq!(
        product.files.keys().collect::<Vec<_>>(),
        full.files.keys().collect::<Vec<_>>(),
        "{scenario}, {phase}: routes"
    );
    for (route, file) in &product.files {
        let bytes = |file: &crate::revision_file::RevisionFile, revision| {
            to_bytes(file.response(revision).into_body(), usize::MAX)
        };
        assert_eq!(
            bytes(file, product.index.revision).await.unwrap(),
            bytes(&full.files[route], full.index.revision)
                .await
                .unwrap(),
            "{scenario}, {phase}: {route}"
        );
    }
    for path in full.details.keys() {
        assert_eq!(
            product.detail(path),
            full.detail(path),
            "{scenario}, {phase}: typed detail {path}"
        );
    }
    assert_eq!(
        product.completed.keys().collect::<Vec<_>>(),
        full.completed.keys().collect::<Vec<_>>(),
        "{scenario}, {phase}: completions"
    );
}

fn rebuild(chains: Option<Chains>, after: Arc<dyn RenderGeneration>) -> Chains {
    let projector = Projector {
        deployment_id: "d".repeat(64),
        render_token: "e".repeat(64),
    };
    let input = |revision| SnapshotInput {
        documents: Arc::new(Unimock::new(())),
        revision,
        config_path: "mokly.config.json".into(),
        base: Some("base".into()),
        assets: BTreeMap::new(),
    };
    match chains {
        None => [
            projector.create(after.clone(), input(1)).unwrap(),
            projector.create(after, input(1)).unwrap(),
        ],
        Some(chains) => chains.map(|previous| {
            projector
                .replace(after.clone(), input(previous.index.revision + 1), &previous)
                .unwrap()
        }),
    }
}

fn usage(after: &dyn RenderGeneration) -> Vec<(String, CatalogueUsage)> {
    after
        .plans()
        .keys()
        .map(|route| {
            (
                route.clone(),
                after.comparison_usage(route).unwrap().unwrap(),
            )
        })
        .collect()
}

fn accepted(
    scenario: &str,
    before: Arc<dyn RenderGeneration>,
    after: Arc<dyn RenderGeneration>,
) -> Arc<Accepted> {
    let engine = Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(1024 * 1024)),
    };
    let request = ComparisonRequest {
        base_ref: "base".into(),
        base_commit: "b".repeat(40),
        catalogue_identity: "a".repeat(64),
    };
    Arc::new(Accepted {
        source: None,
        cancel: Arc::new(ChangeToken::default()),
        id: digest(scenario.as_bytes()),
        result: engine.compare_prepared(&request, before, after).unwrap(),
    })
}
