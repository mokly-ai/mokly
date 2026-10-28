use std::collections::BTreeMap;

use mokly_catalogue::render_sources::{JavaScriptGeneration, ResolvedDefinition};

use super::{RenderInputs, RenderKeys};
use crate::key::{NodeKey, NodeKind, key};

fn fallback() -> NodeKey {
    key(NodeKind::RenderInputs, &[b"whole bundle"])
}

/// Board imports Badge's declaring module, while the badge entry module re-exports it.
fn re_export(declarations: &BTreeMap<String, String>, badge: &str) -> RenderKeys {
    let generation = JavaScriptGeneration {
        modules: BTreeMap::from([
            (
                "specs/badge.mockup.tsx".into(),
                vec!["specs/badge.mokly.tsx".into()],
            ),
            ("specs/badge.mokly.tsx".into(), Vec::new()),
            (
                "specs/board.mockup.tsx".into(),
                vec!["specs/badge.mokly.tsx".into()],
            ),
        ]),
        ..JavaScriptGeneration::default()
    };
    let bindings = BTreeMap::from([
        (
            "specs/badge.mockup.tsx#badge".into(),
            ResolvedDefinition {
                path: badge.into(),
                title: "Badge".into(),
            },
        ),
        (
            "specs/board.mockup.tsx#board".into(),
            ResolvedDefinition {
                path: "board".into(),
                title: "Board".into(),
            },
        ),
    ]);
    RenderKeys::build(
        &RenderInputs {
            generation: &generation,
            bindings: &bindings,
            renderer: None,
            entries: &BTreeMap::new(),
            declarations,
        },
        fallback(),
    )
    .unwrap()
}

#[test]
fn a_re_exported_binding_reaches_the_modules_that_import_its_declaring_module() {
    let declarations = BTreeMap::from([(
        "specs/badge.mockup.tsx#badge".to_owned(),
        "specs/badge.mokly.tsx".to_owned(),
    )]);
    let before = re_export(&declarations, "kit/badge");
    let after = re_export(&declarations, "moved/badge");
    assert_ne!(
        before.module("specs/board.mockup.tsx"),
        after.module("specs/board.mockup.tsx")
    );
    assert_ne!(
        before.module("specs/badge.mockup.tsx"),
        after.module("specs/badge.mockup.tsx")
    );
}
