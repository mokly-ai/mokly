//! Related document references preserve authored order and unmatched labels.

use crate::axes::ColorScheme;
use crate::catalogue::{CatalogueModel, EntryContent, EntryMetadata, ModelEntry, SourceLocation};
use crate::projection::{Publication, index, related_docs};
use crate::public_metadata::ChangesStatus;

#[test]
fn current_metadata_links_discovered_documents_and_keeps_other_labels_in_order() {
    let mut page = entry("page", "specs/page.page.html", EntryContent::Page);
    page.metadata.related_docs = [
        "docs/notes.md",
        "specs/guide.md",
        "specs/page.page.html",
        "specs/Guide.md",
        "guide",
    ]
    .map(String::from)
    .into();
    let model = CatalogueModel {
        entries: vec![
            page,
            entry(
                "guide",
                "specs/guide.md",
                EntryContent::Document {
                    color_schemes: vec![ColorScheme::Light],
                    resources: vec![],
                },
            ),
        ],
        folders: vec![],
        sources: vec![],
        color_schemes: vec![ColorScheme::Light],
    };
    let state = Publication {
        config_path: "mokly.config.json".into(),
        deployment_id: "a".repeat(64),
        revision: 0,
        base: None,
        changes_status: ChangesStatus::Disabled,
        live_generation: None,
    };

    let projected = index(&model, &[], &state);

    assert_eq!(
        projected.pages[0].entry.details.related_docs,
        [
            "docs/notes.md",
            "mock:guide",
            "specs/page.page.html",
            "specs/Guide.md",
            "guide",
        ]
    );
}

#[test]
fn related_doc_resolution_maps_only_the_discovered_catalogue_path() {
    let model = CatalogueModel {
        entries: vec![entry(
            "Guide",
            "specs/guide.md",
            EntryContent::Document {
                color_schemes: vec![ColorScheme::Light],
                resources: vec![],
            },
        )],
        folders: vec![],
        sources: vec![],
        color_schemes: vec![ColorScheme::Light],
    };
    let labels = vec!["specs/guide.md".into(), "docs/notes.md".into()];

    assert_eq!(
        related_docs(&model, &labels, |path| format!("moved/{path}")),
        ["mock:moved/Guide", "docs/notes.md"]
    );
}

fn entry(path: &str, source: &str, content: EntryContent) -> ModelEntry {
    ModelEntry {
        metadata: EntryMetadata {
            path: path.into(),
            title: path.into(),
            description: String::new(),
            tags: vec![],
            rationale: None,
            related_docs: vec![],
            moved_from: None,
            moved_from_source: None,
            variant_of: None,
            is_index: false,
            root_index: 0,
            source: SourceLocation {
                path: source.into(),
                line: 1,
                column: 1,
                export: None,
            },
        },
        content,
    }
}
