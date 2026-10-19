//! Opaque routing work is shared without changing document input identities.

use std::collections::BTreeMap;

use mokly_catalogue::template_types::Template;
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::EntryContent;

#[path = "routing_support.rs"]
mod support;

#[test]
fn routing_keys_preserve_case_aliases_missing_targets_and_flow_steps() {
    let mut catalogue =
        support::catalogue(&["Alpha", "notes", "local", "opaque", "tour"].map(String::from));
    catalogue.model.entries[0].metadata.moved_from = Some("old".into());
    catalogue.model.entries[1].content = EntryContent::Document {
        color_schemes: vec![ColorScheme::Light, ColorScheme::Dark],
        resources: Vec::new(),
    };
    catalogue
        .documents
        .insert("notes".into(), "[Old](mock:old) [Tour](mock:tour)".into());
    catalogue.model.entries[4].content =
        serde_json::from_str(r#"{"kind":"use-case","steps":[{"screenPath":"Alpha"}]}"#).unwrap();
    let body = "<a href=\"mock:ALPHA\">Case</a><a href=\"mock:old\">Old</a><a href=\"mock:missing\">Missing</a>";
    catalogue.templates.insert(
        "local".into(),
        Template {
            source_path: "catalogue.mockup.ts".into(),
            source: body.into(),
            body: body.into(),
            body_offset: 0,
            page: true,
        },
    );
    catalogue
        .slot_fragments
        .insert("opaque".into(), [("children".into(), body.into())].into());
    let keys: BTreeMap<_, _> = support::plans(&catalogue)
        .into_iter()
        .map(|(route, plan)| (route, (plan.key.0, plan.resource_key)))
        .collect();
    insta::assert_debug_snapshot!(keys);
}

#[test]
fn opaque_inventory_still_invalidates_when_an_unseen_target_changes() {
    let mut catalogue = support::catalogue(&["opaque", "target"].map(String::from));
    let before = support::plans(&catalogue);
    catalogue.model.entries[1].metadata.path = "Target".into();
    let after = support::plans(&catalogue);
    assert_ne!(
        before["opaque/index.html"].key,
        after["opaque/index.html"].key
    );
}
