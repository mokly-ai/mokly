//! Independent document safety failures retain the authored Markdown location.

use std::collections::BTreeMap;

use mokly_catalogue::discovery::Inventory;
use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_html::composition::Composed;
use mokly_html::diagnostic_code::Code;
use mokly_html::error::HtmlError;
use mokly_html::{markdown, tree};
use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::{CatalogueModel, ModelEntry};
use mokly_model::usage::CatalogueUsage;
use serde_json::json;
use unimock::Unimock;

use crate::error::GraphError;
use crate::key::NodeKey;
use crate::rendering;
use crate::types::DocumentPlan;

#[test]
fn injected_unsafe_markdown_output_keeps_its_file_and_exact_reason() {
    let entry: ModelEntry = serde_json::from_value(json!({
        "metadata": {"path":"notes","title":"Notes","description":"","tags":[],
            "relatedDocs":[],"isIndex":false,"rootIndex":0,
            "source":{"path":"specs/notes.md","line":1,"column":1}},
        "content":{"kind":"document","colorSchemes":["light"],"resources":[]}
    }))
    .unwrap();
    let catalogue = PreparedCatalogue {
        model: CatalogueModel {
            entries: vec![entry.clone()],
            folders: Vec::new(),
            sources: Vec::new(),
            color_schemes: vec![ColorScheme::Light],
        },
        inventory: Inventory::default(),
        templates: BTreeMap::new(),
        documents: BTreeMap::new(),
        slot_fragments: BTreeMap::new(),
        elements: BTreeMap::new(),
        deferred_modules: Vec::new(),
        warnings: Vec::new(),
    };
    let mut nodes =
        markdown::render("Text", "Notes", ColorScheme::Light, &Unimock::new(())).unwrap();
    let tree::Node::Element(html) = &mut nodes[1] else {
        panic!()
    };
    let tree::Node::Element(body) = &mut html.children[1] else {
        panic!()
    };
    let tree::Node::Element(main) = &mut body.children[0] else {
        panic!()
    };
    main.children.push(tree::element("iframe", &[], Vec::new()));
    let document = Composed {
        tree: nodes,
        usage: CatalogueUsage::Ready {
            instances: Vec::new(),
            slots: Vec::new(),
            ranges: Vec::new(),
        },
        warnings: Vec::new(),
        resources: Vec::new(),
        components: Vec::new(),
        links: Vec::new(),
    };
    let plan = DocumentPlan {
        route: "notes/index.html".into(),
        key: NodeKey("key".into()),
        entry: 0,
        viewport: None,
        color_scheme: ColorScheme::Light,
        stylesheets: Vec::new(),
    };
    let GraphError::Attempt { failures, .. } =
        rendering::finish(document, &plan, &entry, &catalogue).unwrap_err()
    else {
        panic!()
    };
    let GraphError::Html {
        source: HtmlError::Located { location, source },
    } = &failures[0]
    else {
        panic!()
    };
    assert_eq!(location.path, "specs/notes.md");
    assert_eq!((location.line, location.column), (1, 1));
    let HtmlError::Invalid { code, message, .. } = source.as_ref() else {
        panic!()
    };
    assert_eq!(*code, Code::BuildInvalid);
    assert_eq!(
        message,
        "unsafe rendered document: element <iframe> is not allowed"
    );
}
