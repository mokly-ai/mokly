//! Build an isolated Git catalogue and read its validated public comparison records.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_model::public_detail::EntryDetailV2;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::{CatalogueChanges, CatalogueEntry};
use mokly_model::review::{ReviewEntry, ReviewKind, ReviewResultV8, ReviewState, ReviewView};
use mokly_model::review_affected::{AffectedConsumer, AffectedConsumerAddress, ConsumerKind};

use super::changes_support;

pub fn build(before: Vec<(String, String)>, after: Vec<(String, String)>) -> ReviewResultV8 {
    build_configured(before, after, "{\"review\":{\"base\":\"fixture-base\"}}")
}

pub fn build_configured(
    before: Vec<(String, String)>,
    after: Vec<(String, String)>,
    config: &str,
) -> ReviewResultV8 {
    let sources: Vec<_> = before
        .into_iter()
        .map(|(file, source)| (format!("specs/{file}"), source))
        .collect();
    let mut files: Vec<_> = sources
        .iter()
        .map(|(file, source)| (file.as_str(), source.as_str()))
        .collect();
    files.push(("mokly.config.json", config));
    let root = changes_support::base(&files);
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    #[cfg(unix)]
    std::os::unix::fs::symlink(modules, root.path().join("node_modules")).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(modules, root.path().join("node_modules")).unwrap();
    for (file, source) in after {
        changes_support::write(root.path(), &format!("specs/{file}"), &source);
    }
    let output = changes_support::run(root.path(), &["build", "--strict", "--sidecars", "1"]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    public_review(&root.path().join("mokly-static"))
}

/// Rebuild the comparison records that the public index and entry details
/// carry, so the assertions read Changes as every reader does: membership from
/// the index, states, reasons, and evidence from each detail, and affected
/// consumers from the changed components that each consumer's detail names.
fn public_review(site: &Path) -> ReviewResultV8 {
    let index: CatalogueReadModel =
        serde_json::from_slice(&fs::read(site.join("mokly-viewer/index.json")).unwrap()).unwrap();
    let detail = |path: &str| -> EntryDetailV2 {
        serde_json::from_slice(
            &fs::read(site.join(format!("mokly-viewer/entries/{path}.json"))).unwrap(),
        )
        .unwrap()
    };
    let mut entries = Vec::new();
    let mut affected = Vec::new();
    for screen in &index.screens {
        let detail = detail(&screen.entry.path);
        affected.extend(consumers(&detail, ConsumerKind::Screen));
        entries.push(record(ReviewKind::Screen, &screen.entry, &detail));
    }
    let mut components: Vec<ReviewEntry> = Vec::new();
    for component in &index.components {
        let detail = detail(&component.entry.path);
        affected.extend(consumers(&detail, ConsumerKind::Component));
        let entry = record(ReviewKind::Component, &component.entry, &detail);
        match &component.variant_of {
            None => components.push(entry),
            Some(parent) => components
                .iter_mut()
                .find(|candidate| &candidate.path == parent)
                .unwrap()
                .variants
                .get_or_insert_with(Vec::new)
                .push(entry),
        }
    }
    entries.extend(components);
    entries.sort_by(|left, right| (left.kind, &left.path).cmp(&(right.kind, &right.path)));
    affected.sort_by(|left, right| {
        (&left.changed_component_id, &left.consumer.path)
            .cmp(&(&right.changed_component_id, &right.consumer.path))
    });
    ReviewResultV8 {
        schema_version: 8,
        base_commit: index.base_commit.clone().unwrap(),
        entries,
        affected,
        diagnostics: Vec::new(),
    }
}

/// One current entry as its index record and its detail publish it.
fn record(kind: ReviewKind, entry: &CatalogueEntry, detail: &EntryDetailV2) -> ReviewEntry {
    let views: Vec<_> = detail
        .views
        .iter()
        .map(|view| ReviewView {
            viewport: view.viewport,
            color_scheme: view.color_scheme,
            state: view.state.unwrap(),
            ignored_ids: view.ignored_ids.clone().unwrap(),
            rules: view.resource_evidence.as_ref().unwrap().rules.clone(),
            resources: view.resource_evidence.as_ref().unwrap().resources.clone(),
        })
        .collect();
    ReviewEntry {
        kind,
        path: entry.path.clone(),
        title: entry.title.clone(),
        before: detail.before.clone(),
        after: None,
        previous_path: entry.previous_path.clone(),
        state: ReviewState::aggregate(views.iter().map(|view| view.state)),
        included: matches!(
            entry.changes,
            CatalogueChanges::Ready { included: true, .. }
        ),
        reasons: detail.reasons.clone().unwrap_or_default(),
        views,
        variants: None,
    }
}

/// The changed components that a consumer's detail names as affecting it.
fn consumers(detail: &EntryDetailV2, kind: ConsumerKind) -> Vec<AffectedConsumer> {
    detail
        .workspace
        .iter()
        .flat_map(|workspace| &workspace.related_components)
        .map(|component| AffectedConsumer {
            changed_component_id: component.path.clone(),
            consumer: AffectedConsumerAddress {
                kind,
                path: detail.entry.path.clone(),
            },
            evidence: Vec::new(),
        })
        .collect()
}
