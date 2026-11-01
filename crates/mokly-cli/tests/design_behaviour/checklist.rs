//! Checklist's depicted Changes are independent of the Action story.

use mokly_html::tree::Node;
use mokly_model::usage::CatalogueUsage;
use mokly_model::wire_props::ComponentWireValue;

use super::{catalogue, dom, records};

/// Keep the one-entry Changes story and its sole output edit explicit. The
/// parent row and its selected variant row open the same artboard, so both
/// name the current page and both draw the current-row highlight.
pub(crate) fn check() {
    let fixture = catalogue::shared();
    let records = records::read(&fixture);
    let checklist = &records["checklist"];
    let target = checklist["to"].as_str().unwrap();
    let label = checklist["label"].as_str().unwrap();
    let views = fixture.views("design/components/pages/stacked/overlay-tall");
    assert_eq!(views.len(), 2);
    let mut artboards = Vec::new();
    for artifact in views {
        let document = artifact.document.as_ref().unwrap();
        let CatalogueUsage::Ready { instances, .. } = &document.usage else {
            panic!("ready usage")
        };
        let navigation: Vec<_> = instances
            .iter()
            .filter(|instance| {
                instance.component_id == "design/library/chrome/catalogue-navigation"
            })
            .collect();
        let desktop = !dom::class(&document.tree, "mbk-shell--desktop").is_empty();
        artboards.push(desktop);
        assert_eq!(navigation.len(), usize::from(desktop));
        if desktop {
            assert!(
                matches!(&navigation[0].props["changedCount"], ComponentWireValue::Number(_, value) if value == "1")
            );
            assert!(matches!(
                &navigation[0].props["changedOnly"],
                ComponentWireValue::Boolean(_, true)
            ));
            let nav = dom::class(&document.tree, "mbk-nav-scroll");
            assert_eq!(nav.len(), 1);
            let rows: Vec<_> = dom::class(&nav[0].children, "mbk-nav-row")
                .into_iter()
                .filter(|element| element.name == "a")
                .collect();
            let labels: Vec<_> = rows
                .iter()
                .map(|element| {
                    element
                        .children
                        .iter()
                        .filter_map(|node| match node {
                            Node::Text(text) => Some(text.as_str()),
                            _ => None,
                        })
                        .collect::<String>()
                })
                .collect();
            assert_eq!(labels, [label, "Default"]);
            assert_eq!(
                rows.iter()
                    .map(|row| row.get("data-mokly-link"))
                    .collect::<Vec<_>>(),
                [Some(target), Some(target)]
            );
            assert_eq!(
                rows.iter()
                    .map(|row| row.get("aria-current"))
                    .collect::<Vec<_>>(),
                [Some("page"), Some("page")]
            );
            let counts = dom::class(&document.tree, "mbk-nav-filter-count");
            assert_eq!(counts.len(), 1);
            assert_eq!(dom::text(&counts[0].children), "1");
        } else {
            assert_eq!(dom::class(&document.tree, "mbk-shell--mobile").len(), 1);
            let shortcuts = dom::class(&document.tree, "ce-mobile-location");
            assert_eq!(shortcuts.len(), 1);
            let count = dom::class(&shortcuts[0].children, "ce-change-count");
            assert_eq!(count.len(), 1);
            assert_eq!(dom::text(&count[0].children), "1");
            let changes: Vec<_> = dom::elements(&shortcuts[0].children)
                .into_iter()
                .filter(|element| {
                    element.name == "a" && dom::text(&element.children).contains("Changes")
                })
                .collect();
            assert_eq!(changes.len(), 1);
            assert_eq!(changes[0].get("data-mokly-link"), Some(target));
        }
        assert_eq!(
            dom::class(&document.tree, "mbk-entry-status")
                .iter()
                .map(|badge| dom::text(&badge.children))
                .collect::<Vec<_>>(),
            ["Changed"]
        );
        let inspector = dom::class(&document.tree, "mbk-inspector");
        assert_eq!(inspector.len(), 1);
        let panels = dom::elements(&inspector[0].children);
        let open: Vec<_> = panels
            .iter()
            .filter(|element| element.name == "details" && element.get("open").is_some())
            .map(|element| element.get("data-inspector-tab").unwrap())
            .collect();
        assert_eq!(open, ["details"]);
        let usage = panels
            .iter()
            .find(|element| element.get("data-inspector-tab") == Some("usage"))
            .unwrap();
        let usage_text = dom::text(&usage.children);
        assert!(
            usage_text.contains("No recorded consumers."),
            "{usage_text}"
        );
        assert!(!usage_text.contains("Affected screens"), "{usage_text}");
        let previews = dom::class(&document.tree, "ce-preview-view");
        assert_eq!(previews.len(), 2);
        for preview in previews {
            let before = dom::class(&preview.children, "mb-pane--before");
            let after = dom::class(&preview.children, "mb-pane--after");
            assert_eq!((before.len(), after.len()), (1, 1));
            let labels = |nodes: &[Node]| {
                dom::class(nodes, "ce-checklist-label")
                    .into_iter()
                    .map(|element| dom::text(&element.children))
                    .collect::<Vec<_>>()
            };
            let before_labels = labels(&before[0].children);
            let after_labels = labels(&after[0].children);
            assert_eq!((before_labels.len(), after_labels.len()), (24, 24));
            let changed: Vec<_> = before_labels
                .iter()
                .zip(&after_labels)
                .enumerate()
                .filter(|(_, (left, right))| left != right)
                .map(|(index, _)| index)
                .collect();
            assert_eq!(changed, [4]);
            assert_eq!(before_labels[4], "Pick your interests");
            assert_eq!(after_labels[4], "Choose your topics");
            for layer in [before[0], after[0]] {
                let rows: Vec<_> = dom::elements(&layer.children)
                    .into_iter()
                    .filter(|element| element.name == "li")
                    .collect();
                assert_eq!(
                    rows.iter()
                        .enumerate()
                        .filter(|(_, row)| row.get("data-complete").is_some())
                        .map(|(index, _)| index)
                        .collect::<Vec<_>>(),
                    [0, 1, 2]
                );
            }
        }
    }
    artboards.sort();
    assert_eq!(artboards, [false, true]);
}
