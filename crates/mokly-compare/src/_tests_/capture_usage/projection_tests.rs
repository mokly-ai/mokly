//! Exact caller input changes retain their order while captured reads skip restore.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_model::axes::{ColorScheme, EntryKind, Viewport};
use mokly_model::public_detail::{DetailView, InputChange};
use mokly_model::review::ReviewState;
use mokly_model::usage::ComponentInputOwner;
use serde_json::json;

use crate::projection_tests::support::{classified, details, entry, result};
use crate::projection_workspace;

use super::support::{ROUTE, captured, instance, usage};

#[test]
fn captured_workspace_inputs_keep_literal_changes_and_order_without_restoring_documents() {
    let mut button = entry("button", EntryKind::Component, None);
    button.metadata.title = "Button".into();
    let before = vec![
        button,
        entry("replacement", EntryKind::Component, None),
        entry("home", EntryKind::Screen, None),
        entry("home/empty", EntryKind::Screen, Some("home")),
    ];
    let mut after = before.clone();
    after.push(entry("new", EntryKind::Component, None));
    let mut result = result(
        before,
        after,
        vec![classified(
            "home/empty",
            EntryKind::Screen,
            ReviewState::Changed,
        )],
    );
    let before = usage(vec![
        instance("a-second", "button", "second before"),
        instance("b-first", "button", "first before"),
        instance("c-nested", "button", "nested before"),
        instance("d-same", "button", "same"),
        instance("e-replaced", "replacement", "replacement before"),
        instance("f-unpaired", "replacement", "unpaired before"),
    ]);
    let restores = Arc::new(AtomicUsize::new(0));
    result.before = captured(
        result.before.clone(),
        vec![(ROUTE, Some(before))],
        restores.clone(),
    );
    let mut current = details(&result.after.catalogue().model);
    current.retain(|path, _| path == "home/empty");
    let mut nested = instance("c-nested", "button", "nested after");
    nested.owner = ComponentInputOwner::Instance {
        instance_key: "a-second".into(),
    };
    current.get_mut("home/empty").unwrap().views = vec![DetailView {
        viewport: Viewport::Desktop,
        color_scheme: ColorScheme::Light,
        usage: usage(vec![
            instance("a-second", "button", "second after"),
            instance("b-first", "button", "first after"),
            nested,
            instance("d-same", "button", "same"),
            instance("e-replaced", "button", "replacement after"),
            instance("f-unpaired", "new", "unpaired after"),
            instance("g-added", "button", "new instance"),
        ]),
        state: None,
        ignored_ids: None,
        resource_evidence: None,
    }];

    projection_workspace::apply(&mut current, &result).unwrap();
    let workspace = current["home/empty"].workspace.as_ref().unwrap();
    assert_eq!(
        workspace.input_changes,
        serde_json::from_value::<Vec<InputChange>>(json!([
            {
                "instanceId":"a-second", "title":"Button", "viewport":"desktop",
                "colorScheme":"light", "variantPath":"home/empty",
                "before":{"label":["string","second before"]},
                "after":{"label":["string","second after"]}
            },
            {
                "instanceId":"b-first", "title":"Button", "viewport":"desktop",
                "colorScheme":"light", "variantPath":"home/empty",
                "before":{"label":["string","first before"]},
                "after":{"label":["string","first after"]}
            }
        ]))
        .unwrap()
    );
    assert_eq!(
        restores.load(Ordering::SeqCst),
        0,
        "workspace input projection must not restore captured documents"
    );
}
