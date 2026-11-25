//! Provider warnings use the catalogue's resolved story page paths.

use mokly_model::catalogue::{CatalogueModel, ModelEntry};
use serde_json::json;

use crate::diagnostic::{Warning, WarningSubject};
use crate::preparation::PreparedCatalogue;
use crate::render_sources::{IgnoredStoryParameter, ProvidedRendering};

use super::attach;

#[test]
fn ignored_story_parameters_use_the_final_entry_path_and_quote_the_parameter() {
    let mut entries = [
        ("ui/button", None),
        ("ui/button/Alternate", Some("ui/button")),
    ]
    .map(|(path, parent)| {
        serde_json::from_value::<ModelEntry>(json!({
            "metadata": {
                "path": path, "title": "Button", "description": "", "tags": [],
                "relatedDocs": [], "isIndex": false, "rootIndex": 0, "variantOf": parent,
                "source": {"path": "button.stories.tsx", "line": 1, "column": 1},
            },
            "content": {
                "kind": "component", "slots": [], "suppliedSlots": [],
                "visual": {
                    "colorSchemes": ["light"],
                    "propSchema": {"type": "object", "additionalProperties": false},
                    "props": {}, "controls": {}, "controlOrder": [],
                },
            },
        }))
        .unwrap()
    });
    let mut prepared = PreparedCatalogue {
        model: CatalogueModel {
            entries: Vec::new(),
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: Vec::new(),
        },
        inventory: Default::default(),
        templates: Default::default(),
        documents: Default::default(),
        slot_fragments: Default::default(),
        elements: Default::default(),
        prop_validators: Default::default(),
        javascript: Default::default(),
        dependency_directories: Default::default(),
        warnings: Vec::new(),
    };
    let rendering = ProvidedRendering {
        ignored_parameters: [String::new(), String::from("Alternate")]
            .into_iter()
            .map(|slug| {
                (
                    slug,
                    vec![IgnoredStoryParameter {
                        path: "mokly.viewports.tab\"let\\\n\u{85}".into(),
                        reason: "unknown viewport",
                    }],
                )
            })
            .collect(),
        ..ProvidedRendering::default()
    };

    attach(&mut prepared, &mut entries, &rendering);

    assert_eq!(
        prepared.warnings,
        ["ui/button", "ui/button/Alternate"].map(|path| Warning {
            code: "storybook-parameter-ignored",
            subject: WarningSubject::Entry(path.into()),
            message:
                r#"parameter "mokly.viewports.tab\"let\\\u000a\u0085" is ignored: unknown viewport"#
                    .into(),
        })
    );
}
