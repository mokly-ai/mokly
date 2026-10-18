//! Page text traversal preserves entry and exit delimiters and raw text scopes.

use crate::material::Material;

use super::page;

fn element(name: &str, children: Vec<Material>) -> Material {
    Material::Element("html".into(), name.into(), vec![], children)
}
fn text(value: &str) -> Material {
    Material::Text(value.into())
}

#[test]
fn blocks_cells_slots_and_preformatted_text_keep_document_order() {
    let nodes = vec![
        element("head", vec![text("excluded")]),
        element("p", vec![text(" one "), element("b", vec![text("two")])]),
        element(
            "table",
            vec![element(
                "tr",
                vec![
                    element("td", vec![text("a")]),
                    element("th", vec![text("b")]),
                ],
            )],
        ),
        element("pre", vec![text(" raw\n lines ")]),
        Material::Slot("slot".into(), vec![text(" tail  end")]),
        element("noscript", vec![text("excluded")]),
        Material::Element(
            "html".into(),
            "div".into(),
            vec![("aria-hidden".into(), "true".into())],
            vec![text("excluded")],
        ),
    ];
    assert_eq!(page(&nodes), ["one two", "a b", "raw", "lines", "tail end"]);
}
