//! Tree order preserves authored variants, folder metadata, and English titles.

use crate::catalogue::{
    CatalogueModel, EntryContent, EntryMetadata, FolderRecord, ModelEntry, SourceLocation,
    VisualEntry,
};
use crate::public_index::CatalogueNode;

use super::{build, path};

fn source() -> SourceLocation {
    SourceLocation {
        path: "specs/index.page.html".into(),
        line: 1,
        column: 1,
        export: None,
    }
}
fn entry(path: &str, title: &str) -> ModelEntry {
    ModelEntry {
        metadata: EntryMetadata {
            path: path.into(),
            title: title.into(),
            description: String::new(),
            tags: vec![],
            rationale: None,
            related_docs: vec![],
            moved_from: None,
            moved_from_source: None,
            variant_of: None,
            is_index: false,
            source: source(),
            root_index: 0,
        },
        content: EntryContent::Page,
    }
}
fn model(entries: Vec<ModelEntry>) -> CatalogueModel {
    CatalogueModel {
        entries,
        folders: vec![],
        sources: vec![],
        color_schemes: vec![],
    }
}
fn folder(path: &str, order: Vec<&str>) -> FolderRecord {
    FolderRecord {
        path: path.into(),
        title: None,
        order: Some(order.into_iter().map(String::from).collect()),
        hidden: None,
        source: source(),
    }
}

#[test]
fn folder_rows_precede_english_title_order_and_authored_order_keeps_the_rest() {
    let mut catalogue = model(vec![
        entry("o", "Omega"),
        entry("e", "Éclair"),
        entry("a", "Alpha"),
        entry("folder/z", "Zebra"),
    ]);
    let tree = build(&catalogue);
    assert_eq!(
        tree.iter().map(path).collect::<Vec<_>>(),
        ["folder", "a", "e", "o"]
    );
    catalogue.entries.reverse();
    assert_eq!(
        serde_json::to_string(&build(&catalogue)).unwrap(),
        serde_json::to_string(&tree).unwrap()
    );
    catalogue.folders.push(folder("", vec!["o", "...", "a"]));
    assert_eq!(
        build(&catalogue).iter().map(path).collect::<Vec<_>>(),
        ["o", "folder", "e", "a"]
    );
}

#[test]
fn an_index_screen_owns_variants_then_members_and_keeps_hidden_metadata() {
    let mut panel = entry("panel", "Panel");
    panel.metadata.is_index = true;
    panel.content = EntryContent::Screen {
        visual: VisualEntry {
            color_schemes: vec![],
            prop_schema: Default::default(),
            props: Default::default(),
            controls: Default::default(),
        },
        address: None,
        use_case_paths: vec![],
    };
    let mut first = entry("panel/z", "First authored");
    first.metadata.variant_of = Some("panel".into());
    let mut second = entry("panel/a", "Second authored");
    second.metadata.variant_of = Some("panel".into());
    let mut catalogue = model(vec![panel, first, second, entry("panel/guide", "Guide")]);
    let mut record = folder("panel", vec!["guide"]);
    record.hidden = Some(true);
    catalogue.folders.push(record);
    let tree = build(&catalogue);
    let CatalogueNode::Entry {
        hidden,
        children: Some(children),
        ..
    } = &tree[0]
    else {
        panic!("index screen must be an entry node")
    };
    assert!(hidden.is_some());
    assert_eq!(
        children.iter().map(path).collect::<Vec<_>>(),
        ["panel/z", "panel/a", "panel/guide"]
    );
}
