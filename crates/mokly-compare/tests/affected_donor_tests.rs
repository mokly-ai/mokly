//! A reused donor path cannot erase its variants' retained Before usage.

use std::collections::{BTreeMap, BTreeSet};

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_index, projection_workspace};
use mokly_model::projection;
use mokly_model::public_detail::UsageLink;
use mokly_model::review_affected::{ConsumerKind, ReviewSide};

#[expect(
    dead_code,
    reason = "these fixtures delete and edit without relocating files"
)]
mod engine_support;

use engine_support::Fixture;

fn component(title: &str, element: &str, variants: &str, tag: &str) -> String {
    format!(
        "---\ntitle: {title}\nelement: {element}\n\
         propSchema: {{type: object, additionalProperties: false, required: [label], properties: {{label: {{type: string}}}}}}\n\
         props: {{label: Own}}\n{variants}---\n<{tag}>{{{{label}}}}<ui-badge></ui-badge></{tag}>"
    )
}

fn compare(reuse_donor: bool) -> ComparisonResult {
    let badge = "---\ntitle: Badge\nelement: ui-badge\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<strong>Before</strong>";
    let fixture = Fixture::new(&[
        ("specs/badge.component.html", badge),
        (
            "specs/donor.component.html",
            &component(
                "Donor",
                "ui-donor",
                "variants: [{slug: primary, title: Primary, props: {label: Primary}}, {slug: secondary, title: Secondary, props: {label: Secondary}}]\n",
                "div",
            ),
        ),
        (
            "specs/receiver.component.html",
            &component("Receiver", "ui-receiver", "", "section"),
        ),
    ]);
    fixture.remove("specs/donor.component.html");
    if reuse_donor {
        fixture.edit("specs/donor.md", "# Replacement document\n");
    }
    fixture.edit(
        "specs/receiver.component.html",
        &component(
            "Receiver", "ui-receiver",
            "variants: [{slug: primary, title: Primary, movedFrom: donor/primary, props: {label: Primary}}]\n",
            "section",
        ),
    );
    fixture.edit(
        "specs/badge.component.html",
        &badge.replace("Before", "After"),
    );
    fixture.compare().unwrap()
}

fn before_contexts(result: &ComparisonResult, consumer: &str) -> Vec<String> {
    result
        .review
        .affected
        .iter()
        .filter(|effect| effect.consumer.path == consumer)
        .flat_map(|effect| {
            assert_eq!(effect.changed_component_id, "badge");
            assert_eq!(effect.consumer.kind, ConsumerKind::Component);
            effect.evidence.iter()
        })
        .filter(|evidence| evidence.side == ReviewSide::Before)
        .map(|evidence| {
            assert_eq!(evidence.context.kind, ConsumerKind::Component);
            assert_eq!(evidence.via.len(), 1);
            assert_eq!(evidence.via[0].component_id, "badge");
            evidence.context.entry.path.clone()
        })
        .collect()
}

fn usage_links(result: &ComparisonResult) -> Vec<UsageLink> {
    let model = &result.after.catalogue().model;
    let state = projection_index::publication("mokly.config.json".into(), "fixture-base");
    let index = projection::index(model, &[], &state).unwrap();
    let mut details = projection::pending_details(model, &index, &[]);
    let workspace_details: BTreeMap<_, _> = details
        .iter()
        .map(|(path, detail)| (path.clone(), detail))
        .collect();
    for (path, workspace) in mokly_model::projection_usage::workspaces(&workspace_details, &index) {
        if let Some(detail) = details.get_mut(&path) {
            detail.workspace = Some(workspace);
        }
    }
    projection_workspace::apply(&mut details, result).unwrap();
    details
        .remove("badge")
        .unwrap()
        .workspace
        .unwrap()
        .affected
        .unwrap()
}

#[test]
fn reused_donor_keeps_before_evidence_on_the_moved_and_removed_variants() {
    let result = compare(true);
    assert_eq!(
        before_contexts(&result, "receiver/primary"),
        ["donor/primary", "donor/primary"]
    );
    assert_eq!(
        before_contexts(&result, "donor/secondary"),
        ["donor/secondary", "donor/secondary"]
    );
    assert!(
        !result
            .review
            .affected
            .iter()
            .any(|effect| effect.consumer.path == "donor")
    );
    assert_eq!(
        result
            .snapshot
            .removed_entries
            .iter()
            .map(|record| record.entry.metadata().path.as_str())
            .collect::<Vec<_>>(),
        ["donor/secondary"]
    );
    let links = usage_links(&result);
    assert_eq!(
        links
            .iter()
            .map(|link| (link.entry_path.as_str(), link.removed))
            .collect::<BTreeSet<_>>(),
        BTreeSet::from([
            ("donor/secondary", true),
            ("receiver", false),
            ("receiver/primary", false)
        ])
    );
    assert!(links.iter().all(|link| link.entry_path != "donor"));
}

#[test]
fn an_available_removed_donor_keeps_the_existing_parent_grouping() {
    let result = compare(false);
    assert_eq!(
        before_contexts(&result, "donor"),
        [
            "donor",
            "donor",
            "donor/primary",
            "donor/primary",
            "donor/secondary",
            "donor/secondary"
        ]
    );
    assert!(before_contexts(&result, "receiver/primary").is_empty());
    assert!(before_contexts(&result, "donor/secondary").is_empty());
    assert_eq!(
        usage_links(&result)
            .iter()
            .map(|link| (link.entry_path.as_str(), link.removed))
            .collect::<BTreeSet<_>>(),
        BTreeSet::from([
            ("donor", true),
            ("donor/secondary", true),
            ("receiver", false),
            ("receiver/primary", false)
        ])
    );
}
